export function whatsappLink(number: string, message?: string): string {
  const phone = number.replace(/\D/g, '');
  return message ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/${phone}`;
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}
