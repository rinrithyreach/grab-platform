using Grab.Api.Data;
using Grab.Api.DTOs;
using Grab.Api.Middleware;
using Grab.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Grab.Api.Services;

public class CategoryService(GrabDbContext db)
{
    public static void CheckService(MerchantServiceKind service)
    {
        if (service is not (MerchantServiceKind.GrabFood or MerchantServiceKind.GrabExpress))
            throw new ApiException(400, "Categories are available for GrabFood and GrabExpress only.");
    }

    public async Task<List<CategoryDto>> List(MerchantServiceKind? service, bool admin, CancellationToken ct)
    {
        if (service.HasValue) CheckService(service.Value);
        return await db.ProductCategories.AsNoTracking().Where(x => service == null || x.Service == service)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ThenBy(x => x.Id)
            .Select(x => new CategoryDto(x.Id, x.Service, x.Name, x.KhmerName, x.ParentId, x.SortOrder,
                admin ? db.MerchantListings.Count(l => l.CategoryId == x.Id) : 0,
                admin ? db.ProductCategories.Count(c => c.ParentId == x.Id) : 0)).ToListAsync(ct);
    }

    public static async Task ValidateAssignment(GrabDbContext db, Guid? categoryId, MerchantServiceKind service, CancellationToken ct)
    {
        if (categoryId.HasValue && !await db.ProductCategories.AnyAsync(x => x.Id == categoryId && x.Service == service, ct))
            throw new ApiException(400, "Choose a category or subcategory belonging to this product's service.");
    }

    private static string Clean(string? text, int min, int max, string field)
    {
        var value = text?.Trim() ?? "";
        if (value.Length < min || value.Length > max || value.Any(char.IsControl))
            throw new ApiException(400, $"{field} must contain {min}-{max} characters without control characters.");
        return value;
    }

    public async Task<Guid> Save(Guid actorId, Guid? id, SaveCategoryRequest r, CancellationToken ct)
    {
        CheckService(r.Service);
        var name = Clean(r.Name, 2, 100, "Category name");
        var khmer = string.IsNullOrWhiteSpace(r.KhmerName) ? null : Clean(r.KhmerName, 1, 100, "Khmer name");
        if (r.SortOrder is < 0 or > 999) throw new ApiException(400, "Position must be between 0 and 999.");
        var row = id.HasValue ? await db.ProductCategories.SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ApiException(404, "Category not found.") : new ProductCategory();
        if (r.ParentId.HasValue)
        {
            if (r.ParentId == row.Id) throw new ApiException(400, "A category cannot be its own parent.");
            var parent = await db.ProductCategories.AsNoTracking().SingleOrDefaultAsync(x => x.Id == r.ParentId, ct)
                ?? throw new ApiException(400, "Choose an existing parent category.");
            if (parent.Service != r.Service) throw new ApiException(400, "Parent and subcategory must use the same service.");
            if (parent.ParentId.HasValue) throw new ApiException(400, "Subcategories cannot contain another level of subcategories.");
            if (await db.ProductCategories.AnyAsync(x => x.ParentId == row.Id, ct))
                throw new ApiException(409, "Move or remove this category's subcategories before making it a subcategory.");
        }
        if (id.HasValue && row.Service != r.Service && (await db.MerchantListings.AnyAsync(x => x.CategoryId == row.Id, ct)
            || await db.ProductCategories.AnyAsync(x => x.ParentId == row.Id, ct)))
            throw new ApiException(409, "Reassign products and subcategories before changing this category's service.");
        if (await db.ProductCategories.AnyAsync(x => x.Id != row.Id && x.Service == r.Service && x.ParentId == r.ParentId && x.Name.ToUpper() == name.ToUpper(), ct))
            throw new ApiException(409, "This category name already exists under the selected service and parent.");
        row.Service = r.Service; row.Name = name; row.KhmerName = khmer; row.ParentId = r.ParentId; row.SortOrder = r.SortOrder;
        if (!id.HasValue) db.ProductCategories.Add(row);
        await Audit(actorId, row.Id, $"{(id.HasValue ? "Updated" : "Created")} {(r.ParentId.HasValue ? "subcategory" : "category")} {name}", r.Reason, ct);
        return row.Id;
    }

    public async Task Delete(Guid actorId, Guid id, string? reason, CancellationToken ct)
    {
        var row = await db.ProductCategories.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiException(404, "Category not found.");
        if (await db.ProductCategories.AnyAsync(x => x.ParentId == id, ct)) throw new ApiException(409, "Move or delete the subcategories first.");
        if (await db.MerchantListings.AnyAsync(x => x.CategoryId == id, ct)) throw new ApiException(409, "Reassign this category's products before deleting it.");
        db.ProductCategories.Remove(row);
        await Audit(actorId, row.Id, $"Deleted category {row.Name}", reason, ct);
    }

    private async Task Audit(Guid actorId, Guid targetId, string action, string? reason, CancellationToken ct)
    {
        var why = Clean(reason, 3, 300, "Reason");
        var actor = await db.Users.AsNoTracking().SingleAsync(x => x.Id == actorId, ct);
        db.AdminAudits.Add(new AdminAudit { ActorId = actorId, ActorName = actor.FullName, Resource = "categories", TargetId = targetId,
            Action = action.Length > 100 ? action[..100] : action, Reason = why });
        await db.SaveChangesAsync(ct);
    }
}
