using Microsoft.EntityFrameworkCore;
using PhoneBookAPI.Data.Entities;
using PhoneBookAPI.Data.Enums;

namespace PhoneBookAPI.Data;

public class PhoneBookDbContext(DbContextOptions<PhoneBookDbContext> options) : DbContext(options)
{
    public DbSet<User> Users { get; set; }
    public DbSet<Contact> Contacts { get; set; }
    public DbSet<Message> Messages { get; set; }

    private static readonly DateTime SeedDate = new(new DateOnly(2025, 1, 1), TimeOnly.MinValue, DateTimeKind.Utc);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>().HasData(
            new { Id = 1, Email = "admin@example.com", Name = "Admin", Surname = "Smith", Password = "123456", CreatedAt = SeedDate, UpdatedAt = SeedDate }
        );

        modelBuilder.Entity<Contact>().HasData(BuildContacts());
        modelBuilder.Entity<Message>().HasData(BuildMessages());
    }

    private static object[] BuildContacts()
    {
        (string Name, string Surname, string Phone)[] people =
        [
            ("Joh", "Smith", "+15551231234"),
            ("Amara", "Okafor", "+15551230002"),
            ("Bruno", "Cardoso", "+15551230003"),
            ("Chen", "Wei", "+15551230004"),
            ("Dalia", "Haddad", "+15551230005"),
            ("Eero", "Virtanen", "+15551230006"),
            ("Fatima", "Zahra", "+15551230007"),
            ("Grigor", "Petrov", "+15551230008"),
            ("Hana", "Kobayashi", "+15551230009"),
            ("Ingrid", "Larsen", "+15551230010"),
            ("Javier", "Morales", "+15551230011"),
            ("Keziah", "Mwangi", "+15551230012"),
            ("Liesel", "Braun", "+15551230013"),
            ("Mateo", "Rossi", "+15551230014"),
            ("Nadia", "Popescu", "+15551230015"),
        ];

        return people
            .Select((person, index) => (object)new
            {
                Id = index + 1,
                Name = person.Name,
                Surname = person.Surname,
                Email = $"{person.Name.ToLowerInvariant()}@example.com",
                PhoneNumber = person.Phone,
                UserId = 1,
                CreatedAt = SeedDate,
                UpdatedAt = SeedDate,
            })
            .ToArray();
    }

    private static object[] BuildMessages()
    {
        string[] bodies =
        [
            "Confirming our appointment for next week.",
            "Your prescription is ready for collection.",
            "Reminder: annual eye exam is due.",
            "Thanks for coming in today.",
            "We have moved your booking to the afternoon.",
            "Your new frames have arrived.",
        ];

        var statuses = Enum.GetValues<MessageStatus>();
        var types = Enum.GetValues<MessageType>();

        return Enumerable.Range(0, 30)
            .Select(index => (object)new
            {
                Id = index + 1,
                Type = types[index % types.Length],
                Body = bodies[index % bodies.Length],
                ContactId = (index % 15) + 1,
                UserId = 1,
                Date = SeedDate.AddDays(-index * 2).AddHours(9 + (index % 8)),
                Status = statuses[index % statuses.Length],
            })
            .ToArray();
    }
}
