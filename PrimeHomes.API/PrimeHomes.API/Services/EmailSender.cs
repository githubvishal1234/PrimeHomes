using System.Net;
using System.Net.Mail;

namespace PrimeHomes.API.Services
{
    /// <summary>
    /// Sends through SMTP when Email:Smtp:Host is configured; otherwise writes the email to the log
    /// (development default, so links such as password reset can be copied from the API console).
    /// </summary>
    public class EmailSender
    {
        private readonly IConfiguration _config;
        private readonly ILogger<EmailSender> _logger;

        public EmailSender(IConfiguration config, ILogger<EmailSender> logger)
        {
            _config = config;
            _logger = logger;
        }

        // ponytail: sent inline with the request; move to a background queue if SMTP latency becomes noticeable.
        public async Task SendAsync(string to, string subject, string body)
        {
            var host = _config["Email:Smtp:Host"];

            if (string.IsNullOrWhiteSpace(host))
            {
                _logger.LogInformation("EMAIL (dev log, SMTP not configured)\nTo: {To}\nSubject: {Subject}\n{Body}", to, subject, body);
                return;
            }

            try
            {
                using var client = new SmtpClient(host, _config.GetValue("Email:Smtp:Port", 587))
                {
                    EnableSsl = _config.GetValue("Email:Smtp:EnableSsl", true),
                    Credentials = new NetworkCredential(_config["Email:Smtp:User"], _config["Email:Smtp:Password"])
                };

                var from = _config["Email:From"] ?? "no-reply@primehomes.local";
                await client.SendMailAsync(new MailMessage(from, to, subject, body));
            }
            catch (Exception ex)
            {
                // A failed email must not fail the user's action; the in-app notification still exists.
                _logger.LogError(ex, "Failed to send email to {To} ({Subject})", to, subject);
            }
        }

        /// <summary>Absolute link into the Angular app, e.g. Link("/reset-password?...").</summary>
        public string Link(string pathAndQuery) =>
            $"{(_config["App:BaseUrl"] ?? "http://localhost:4200").TrimEnd('/')}{pathAndQuery}";
    }
}
