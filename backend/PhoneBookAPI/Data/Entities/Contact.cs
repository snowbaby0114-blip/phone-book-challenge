namespace PhoneBookAPI.Data.Entities;

public class Contact
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Surname { get; set; }
    public string PhoneNumber { get; set; }
    public string Email { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int UserId { get; set; }
    public virtual User User { get; set; }
    public List<Message> Messages { get; set; }
}