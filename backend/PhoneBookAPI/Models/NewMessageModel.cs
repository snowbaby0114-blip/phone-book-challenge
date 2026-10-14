using System.ComponentModel.DataAnnotations;
using PhoneBookAPI.Data.Enums;

namespace PhoneBookAPI.Models;

public class NewMessageModel
{
    [Range(1, int.MaxValue)]
    public int ContactId { get; set; }

    [Required]
    [EnumDataType(typeof(MessageType))]
    public MessageType? Type { get; set; }

    [Required]
    [StringLength(1000)]
    public string Body { get; set; } = string.Empty;
}
