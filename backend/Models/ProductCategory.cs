namespace Grab.Api.Models;

public class ProductCategory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public MerchantServiceKind Service { get; set; }
    public string Name { get; set; } = "";
    public string? KhmerName { get; set; }
    public Guid? ParentId { get; set; }
    public ProductCategory? Parent { get; set; }
    public int SortOrder { get; set; }
}
