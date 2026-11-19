using System.Text.Json;
using System.Text.Json.Serialization;

namespace PrimeHomes.API.Services
{
    /// <summary>
    /// All dates are stored in UTC. SQL Server hands them back without a kind, so mark them UTC
    /// on the way out ("...Z"); browsers then show them in the viewer's local time.
    /// </summary>
    public class UtcDateTimeConverter : JsonConverter<DateTime>
    {
        public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
            reader.GetDateTime().ToUniversalTime();

        public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options) =>
            writer.WriteStringValue(value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
                : value.ToUniversalTime());
    }
}
