using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Grab.Api.DTOs;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    private static readonly byte[] BannerPng = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=");

    private static MultipartFormDataContent BannerForm(string title, int position = 0, bool active = true, bool withImage = true)
    {
        var form = new MultipartFormDataContent();
        form.Add(new StringContent(title), "title");
        form.Add(new StringContent("Uploaded from the admin dashboard"), "subtitle");
        form.Add(new StringContent("/food"), "linkUrl");
        form.Add(new StringContent(position.ToString()), "sortOrder");
        form.Add(new StringContent(active.ToString()), "isActive");
        form.Add(new StringContent("Manage homepage promotion"), "reason");
        if (withImage)
        {
            var image = new ByteArrayContent(BannerPng);
            image.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            form.Add(image, "image", "offer.png");
        }
        return form;
    }

    [Fact]
    public async Task Admin_banner_uploads_persist_serve_images_and_follow_homepage_order_and_visibility()
    {
        await using var factory = new ApiFactory();
        await factory.InitializeDatabase();
        using var admin = await Admin(factory);
        using var guest = factory.CreateClient();
        using var customer = factory.CreateClient();
        await Register(customer, factory.Password);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/admin/banners")).StatusCode);
        using (var form = BannerForm("Forbidden upload"))
            Assert.Equal(HttpStatusCode.Forbidden, (await customer.PostAsync("/api/admin/banners", form)).StatusCode);
        using (var form = BannerForm("Missing image", withImage: false))
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsync("/api/admin/banners", form)).StatusCode);

        Guid laterId;
        using (var form = BannerForm("Later promotion", 10))
        {
            var response = await admin.PostAsync("/api/admin/banners", form);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            laterId = (await Read<JsonElement>(response)).GetProperty("id").GetGuid();
        }
        using (var form = BannerForm("First promotion", 0))
            Assert.Equal(HttpStatusCode.Created, (await admin.PostAsync("/api/admin/banners", form)).StatusCode);

        var publicBanners = await Read<List<BannerDto>>(await guest.GetAsync("/api/banners"));
        Assert.Equal(new[] { "First promotion", "Later promotion" }, publicBanners.Select(banner => banner.Title));
        var originalImage = publicBanners.Single(banner => banner.Id == laterId).ImageUrl;
        var imageResponse = await guest.GetAsync(originalImage);
        Assert.Equal(HttpStatusCode.OK, imageResponse.StatusCode);
        Assert.Equal("image/png", imageResponse.Content.Headers.ContentType?.MediaType);
        Assert.Equal(BannerPng, await imageResponse.Content.ReadAsByteArrayAsync());
        using (var fresh = await Admin(factory))
            Assert.Equal(2, (await Read<List<AdminBannerDto>>(await fresh.GetAsync("/api/admin/banners"))).Count);

        using (var form = BannerForm("Hidden promotion", 10, active: false, withImage: false))
        using (var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/banners/{laterId}") { Content = form })
            Assert.Equal(HttpStatusCode.OK, (await admin.SendAsync(request)).StatusCode);
        Assert.Single(await Read<List<BannerDto>>(await guest.GetAsync("/api/banners")));
        var hidden = (await Read<List<AdminBannerDto>>(await admin.GetAsync("/api/admin/banners"))).Single(banner => banner.Id == laterId);
        Assert.False(hidden.IsActive);
        Assert.Equal(originalImage, hidden.ImageUrl);

        using (var form = BannerForm("Replaced promotion", 0))
        using (var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/banners/{laterId}") { Content = form })
            Assert.Equal(HttpStatusCode.OK, (await admin.SendAsync(request)).StatusCode);
        var updated = (await Read<List<BannerDto>>(await guest.GetAsync("/api/banners"))).Single(banner => banner.Id == laterId);
        Assert.NotEqual(originalImage, updated.ImageUrl);
        Assert.Equal(HttpStatusCode.NotFound, (await guest.GetAsync(originalImage)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await guest.GetAsync(updated.ImageUrl)).StatusCode);
    }
}
