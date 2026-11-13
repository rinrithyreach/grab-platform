using Grab.Api.Models;
using Microsoft.AspNetCore.Mvc;
namespace Grab.Api.Controllers;
public abstract class ApiControllerBase : ControllerBase
{
    protected Guid UserId => Guid.Parse(User.FindFirst("sub")!.Value);
    protected Role UserRole => Enum.Parse<Role>(User.FindFirst("role")!.Value);
}
