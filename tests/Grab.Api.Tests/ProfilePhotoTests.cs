using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Grab.Api.DTOs;

namespace Grab.Api.Tests;

public partial class ApiTests
{
    private static MultipartFormDataContent ProfilePhotoForm(byte[]? bytes = null, string mime = "image/png")
    {
        var form = new MultipartFormDataContent();
        var photo = new ByteArrayContent(bytes ?? BannerPng);
        photo.Headers.ContentType = new MediaTypeHeaderValue(mime);
        form.Add(photo, "file", "profile.png");
        return form;
    }

    [Fact]
    public async Task Profile_photo_upload_replace_remove_persists_after_signin_and_stays_private()
    {
        await using var factory = new ApiFactory();
        await factory.InitializeDatabase();
        using var customer = factory.CreateClient();
        using var stranger = factory.CreateClient();
        using var guest = factory.CreateClient();
        var account = await Register(customer, factory.Password);
        await Register(stranger, factory.Password);
        using (var form = ProfilePhotoForm())
            Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PostAsync("/api/auth/me/avatar", form)).StatusCode);
        using (var form = ProfilePhotoForm("<svg>not-an-allowed-photo</svg>"u8.ToArray(), "image/png"))
            Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsync("/api/auth/me/avatar", form)).StatusCode);
        using (var form = ProfilePhotoForm(new byte[512 * 1024 + 1]))
            Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsync("/api/auth/me/avatar", form)).StatusCode);

        var expected = $"data:image/png;base64,{Convert.ToBase64String(BannerPng)}";
        using (var form = ProfilePhotoForm())
        {
            var response = await customer.PostAsync("/api/auth/me/avatar", form);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(expected, (await Read<UserDto>(response)).AvatarUrl);
        }
        Assert.Equal(expected, (await Read<UserDto>(await customer.GetAsync("/api/auth/me"))).AvatarUrl);
        Assert.Null((await Read<UserDto>(await stranger.GetAsync("/api/auth/me"))).AvatarUrl);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/auth/me")).StatusCode);
        var renamed = await Read<UserDto>(await customer.PatchAsJsonAsync("/api/auth/me", new UpdateProfileRequest("Photo Customer")));
        Assert.Equal(expected, renamed.AvatarUrl);
        using var fresh = factory.CreateClient();
        var login = await Read<AuthResponse>(await fresh.PostAsJsonAsync("/api/auth/login", new LoginRequest(account.User.PhoneNumber, factory.Password)));
        Assert.Equal(expected, login.User.AvatarUrl);

        var replacement = BannerPng.Concat(new byte[] { 0 }).ToArray();
        using (var form = ProfilePhotoForm(replacement))
        {
            var response = await customer.PostAsync("/api/auth/me/avatar", form);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.NotEqual(expected, (await Read<UserDto>(response)).AvatarUrl);
        }
        Assert.Null((await Read<UserDto>(await customer.DeleteAsync("/api/auth/me/avatar"))).AvatarUrl);
        Assert.Null((await Read<UserDto>(await customer.GetAsync("/api/auth/me"))).AvatarUrl);
        Assert.Equal(HttpStatusCode.OK, (await customer.DeleteAsync("/api/auth/me/avatar")).StatusCode);
    }
}
