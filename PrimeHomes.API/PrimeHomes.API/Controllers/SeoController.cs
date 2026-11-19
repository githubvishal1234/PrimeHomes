using System.Text;
using System.Xml.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PrimeHomes.API.Data;
using PrimeHomes.API.Models;
using PrimeHomes.API.Services;

namespace PrimeHomes.API.Controllers
{
    /// <summary>robots.txt and sitemap.xml for search engines. Served at the site root (proxied to the API).</summary>
    [ApiController]
    public class SeoController : ControllerBase
    {
        private readonly PrimeHomesDbContext _context;
        private readonly EmailSender _links;

        public SeoController(PrimeHomesDbContext context, EmailSender links)
        {
            _context = context;
            _links = links;
        }

        [HttpGet("/robots.txt")]
        public ContentResult Robots() => Content(
            "User-agent: *\n" +
            "Disallow: /admin-dashboard\nDisallow: /owner-dashboard\nDisallow: /buyer-dashboard\n" +
            "Disallow: /my-properties\nDisallow: /add-property\nDisallow: /profile\nDisallow: /notifications\n" +
            $"Sitemap: {_links.Link("/sitemap.xml")}\n",
            "text/plain", Encoding.UTF8);

        [HttpGet("/sitemap.xml")]
        [ResponseCache(Duration = 3600)]
        public async Task<ContentResult> Sitemap()
        {
            XNamespace ns = "http://www.sitemaps.org/schemas/sitemap/0.9";

            var listings = await _context.Properties.AsNoTracking()
                .Where(p => p.Status == PropertyStatus.Approved)
                .Select(p => new { p.PropertyId, p.Title, p.City, Modified = p.UpdatedDate ?? p.ApprovedDate ?? p.CreatedDate })
                .ToListAsync();

            XElement Url(string path, DateTime? modified = null) => new(ns + "url",
                new XElement(ns + "loc", _links.Link(path)),
                modified is { } m ? new XElement(ns + "lastmod", m.ToString("yyyy-MM-dd")) : null);

            var doc = new XElement(ns + "urlset",
                Url("/"),
                Url("/properties"),
                Url("/properties?type=rent"),
                listings.Select(l => l.City).Distinct().Select(city => Url($"/properties?city={Uri.EscapeDataString(city)}")),
                listings.Select(l => Url($"/properties/{l.PropertyId}/{Slug.For(l.Title, l.City)}", l.Modified)));

            return Content(new XDeclaration("1.0", "utf-8", null) + "\n" + doc, "application/xml", Encoding.UTF8);
        }
    }
}
