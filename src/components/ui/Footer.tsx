import { Link } from "react-router-dom";
import { site } from "../../config/site";
import { Logo } from "./Logo";

const cols = [
  { title: "Product", links: [["Follower Tracker", "/"], ["Story Viewer", "/story-viewer"], ["Pricing", "/plans"], ["Login", "/login"]] },
  { title: "Legal", links: [["Terms of Service", "/terms"], ["Privacy Policy", "/privacy"], ["Refund Policy", "/refund-policy"]] },
  { title: "Support", links: [["Contact Us", "/contact"], [site.supportEmail, `mailto:${site.supportEmail}`]] },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-gray-500">
            Track public Instagram follow activity: new following, new followers and unfollows, sorted newest first.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="text-sm font-bold text-ink">{c.title}</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              {c.links.map(([label, to]) => (
                <li key={label}>
                  {to.startsWith("mailto:") ? (
                    <a href={to} className="break-all hover:text-brand-magenta">{label}</a>
                  ) : (
                    <Link to={to} className="hover:text-brand-magenta">{label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pb-24 pt-5 text-xs sm:pb-5 text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {site.name}. All rights reserved.</span>
          <span>{site.name} is not affiliated with, endorsed by, or sponsored by Instagram or Meta Platforms, Inc.</span>
        </div>
      </div>
    </footer>
  );
}
export default Footer;
