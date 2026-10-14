using System.ComponentModel.DataAnnotations;

namespace PhoneBookAPI.Models;

public class NewContactModel
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string Surname { get; set; } = string.Empty;

    [Required]
    [StringLength(30)]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [StringLength(254)]
    public string Email { get; set; } = string.Empty;
}
