using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Grab.Api.DTOs;
using Grab.Api.Models;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    private static SaveCategoryRequest Category(string name, MerchantServiceKind service = MerchantServiceKind.GrabFood, Guid? parent = null) =>
        new(service, name, null, parent, 0, "Organize product catalog");
    private static async Task<Guid> CreateCategory(HttpClient admin, SaveCategoryRequest request)
    {
        var response = await admin.PostAsJsonAsync("/api/admin/categories", request, Json);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await Read<JsonElement>(response)).GetProperty("id").GetGuid();
    }

    [Fact]
    public async Task Categories_enforce_permissions_service_boundaries_hierarchy_and_unique_names()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f); using var guest = f.CreateClient(); using var customer = f.CreateClient();
        await Register(customer, f.Password);
        Assert.Equal(HttpStatusCode.OK, (await guest.GetAsync("/api/categories")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/admin/categories")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.PostAsJsonAsync("/api/admin/categories", Category("Meals"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await guest.GetAsync("/api/categories?service=GrabRide")).StatusCode);
        var root = await CreateCategory(admin, Category("Meals"));
        var child = await CreateCategory(admin, Category("Rice", parent: root));
        var shop = await CreateCategory(admin, Category("Meals", MerchantServiceKind.GrabExpress));
        foreach (var request in new[] { Category(" meals "), Category("Rice", parent: root), Category("Invalid", MerchantServiceKind.GrabRide), Category("Cross service", MerchantServiceKind.GrabExpress, root), Category("Third level", parent: child), Category("Missing parent", parent: Guid.NewGuid()), Category("Missing reason") with { Reason = "" } })
        {
            var response = await admin.PostAsJsonAsync("/api/admin/categories", request, Json);
            Assert.True(response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict, await response.Content.ReadAsStringAsync());
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"/api/admin/categories/{root}", Category("Meals", parent: root), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync($"/api/admin/categories/{root}", Category("Meals", MerchantServiceKind.GrabExpress), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.DeleteAsync($"/api/admin/categories/{root}?reason=Delete%20category")).StatusCode);
        var food = await Read<List<CategoryDto>>(await guest.GetAsync("/api/categories?service=GrabFood"));
        Assert.Equal(2, food.Count); Assert.All(food, c => Assert.Equal(MerchantServiceKind.GrabFood, c.Service));
        Assert.Equal(shop, Assert.Single(await Read<List<CategoryDto>>(await guest.GetAsync("/api/categories?service=GrabExpress"))).Id);

        var role = await CreateRole(admin, "Category observer", "categories.view");
        await admin.PostAsJsonAsync("/api/admin/team", new CreateAdminRequest("Catalog observer", "categories@example.test", "Category observer", f.Password, "Read-only catalog access", role), Json);
        using var viewer = await AdminByEmail(f, "categories@example.test", f.Password);
        Assert.Equal(HttpStatusCode.OK, (await viewer.GetAsync("/api/admin/categories")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.PostAsJsonAsync("/api/admin/categories", Category("No permission"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.PutAsJsonAsync($"/api/admin/categories/{child}", Category("Changed", parent: root), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.DeleteAsync($"/api/admin/categories/{child}?reason=Delete%20category")).StatusCode);
    }

    [Fact]
    public async Task Categories_classify_products_filter_before_pagination_and_protect_assigned_categories()
    {
        await using var f = new ApiFactory(); await f.InitializeDatabase();
        using var admin = await Admin(f); using var merchant = f.CreateClient(); using var shop = f.CreateClient(); using var guest = f.CreateClient();
        await MerchantAccount(merchant, f.Password); await MerchantAccount(shop, f.Password, MerchantServiceKind.GrabExpress);
        var root = await CreateCategory(admin, Category("Food"));
        var child = await CreateCategory(admin, Category("Rice", parent: root));
        var shopCategory = await CreateCategory(admin, Category("Electronics", MerchantServiceKind.GrabExpress));
        var (_, listing) = await PublishedListing(merchant);
        var (_, shopListing) = await PublishedListing(shop);
        var edit = new MerchantListingRequest(listing.Title, listing.Description, listing.Price, listing.ImageId, true, false, child);
        Assert.Equal(HttpStatusCode.OK, (await merchant.PatchAsJsonAsync($"/api/merchants/listings/{listing.Id}", edit, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await shop.PatchAsJsonAsync($"/api/merchants/listings/{shopListing.Id}", new MerchantListingRequest(shopListing.Title, shopListing.Description, shopListing.Price, shopListing.ImageId, true, false, child), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PatchAsJsonAsync($"/api/admin/listings/{listing.Id}", new AdminListingRequest(listing.Title, listing.Description, listing.Price, true, false, "Invalid service category", shopCategory), Json)).StatusCode);
        foreach (var id in new[] { root, child })
        {
            var offers = await Read<List<MerchantOfferDto>>(await guest.GetAsync($"/api/merchants/offers?service=GrabFood&categoryId={id}"));
            var offer = Assert.Single(offers); Assert.Equal(listing.Id, offer.Id); Assert.Equal(child, offer.CategoryId);
        }
        Assert.Empty(await Read<List<MerchantOfferDto>>(await guest.GetAsync($"/api/merchants/offers?categoryId={root}&page=2")));
        Assert.Equal(HttpStatusCode.BadRequest, (await guest.GetAsync($"/api/merchants/offers?service=GrabExpress&categoryId={root}")).StatusCode);
        var categories = await Read<List<CategoryDto>>(await admin.GetAsync("/api/admin/categories"));
        Assert.Equal(1, categories.Single(c => c.Id == child).ProductCount);
        Assert.Equal(1, categories.Single(c => c.Id == root).SubcategoryCount);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.DeleteAsync($"/api/admin/categories/{child}?reason=Delete%20assigned")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync($"/api/admin/categories/{child}", Category("Rice", MerchantServiceKind.GrabExpress), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/admin/categories/{child}", Category("Rice dishes", parent: root) with { KhmerName = "បាយ", SortOrder = 2 }, Json)).StatusCode);
        var dashboard = await Read<MerchantDashboardDto>(await merchant.GetAsync("/api/merchants/me"));
        Assert.Equal(child, Assert.Single(dashboard.Listings).CategoryId);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync($"/api/admin/listings/{listing.Id}", new AdminListingRequest(listing.Title, listing.Description, listing.Price, true, false, "Reassign category", root), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/admin/categories/{child}?reason=Remove%20empty")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await merchant.PatchAsJsonAsync($"/api/merchants/listings/{listing.Id}", edit with { CategoryId = null }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/admin/categories/{root}?reason=Remove%20empty")).StatusCode);
        Assert.Empty(await Read<List<CategoryDto>>(await guest.GetAsync("/api/categories?service=GrabFood")));
        Assert.Equal(6, (await Read<AdminPage<AdminAudit>>(await admin.GetAsync("/api/admin/audit?filter=categories"))).Total);
    }
}
