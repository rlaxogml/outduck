import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(value: string): string {
  const clean = value.replace(/[^0-9]/g, "");
  
  // Handle Seoul area code (02)
  if (clean.startsWith("02")) {
    if (clean.length < 3) return clean;
    if (clean.length < 6) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
    if (clean.length < 10) return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5)}`;
    return `${clean.slice(0, 2)}-${clean.slice(2, 6)}-${clean.slice(6, 10)}`;
  }
  
  // Handle standard prefixes (010, 031, 070, etc.)
  if (clean.length < 4) return clean;
  if (clean.length < 7) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  if (clean.length < 11) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 11)}`;
}

export function linkifyHtml(htmlString: string | null | undefined): string {
  if (!htmlString) return "";
  
  // Split the HTML by tags to avoid matching URLs inside tag attributes (like src, href)
  const parts = htmlString.split(/(<[^>]+>)/g);
  
  let inAnchor = false;
  // Regex to match URLs starting with http://, https://, or www.
  // It stops before whitespace, angle brackets, or trailing punctuation (. , : ; ! ? ' " ) ] })
  const urlRegex = /((?:https?:\/\/|www\.)[^\s<]+[^<.,:;"')\]\}\s])/gi;
  
  const result = parts.map(part => {
    if (part.startsWith('<') && part.endsWith('>')) {
      const tagName = part.match(/^<\/?([a-zA-Z0-9:-]+)/)?.[1]?.toLowerCase();
      if (tagName === 'a') {
        if (part.startsWith('</')) {
          inAnchor = false;
        } else {
          inAnchor = true;
        }
      }
      return part;
    } else {
      if (inAnchor) {
        return part;
      }
      
      return part.replace(urlRegex, (match) => {
        let href = match;
        if (!/^https?:\/\//i.test(match)) {
          href = `https://${match}`;
        }
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline break-all">${match}</a>`;
      });
    }
  });
  
  return result.join('');
}

