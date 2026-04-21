import sanitizeHtml from 'sanitize-html';

export const sanitizeEpubHtml = async (htmlContent: string): Promise<string> => {
  return new Promise((resolve) => {
    // Büyük HTML içeriklerinde UI thread'i bloklamamak için setTimeout kullanıyoruz
    setTimeout(() => {
      const cleanHtml = sanitizeHtml(htmlContent, {
        allowedTags: [
          'p', 'b', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'div', 'span', 'img', 'a', 'ul', 'ol', 'li', 'br', 
          'section', 'article', 'em', 'strong', 'blockquote', 'hr',
          'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption',
          'svg', 'image', 'nav', 'dl', 'dt', 'dd',
          // Dış kabuğu korumak için gerekli etiketler (özel kural)
          'html', 'head', 'body', 'meta', 'title', 'link'
        ],
        allowedAttributes: {
          '*': ['id', 'style', 'class', 'alt', 'src', 'href', 'width', 'height', 'dir', 'lang', 'name', 'xmlns', 'xmlns:xlink', 'viewBox'],
          'image': ['href', 'xlink:href', 'width', 'height'],
          'svg': ['viewBox', 'width', 'height', 'version', 'xmlns', 'xmlns:xlink'],
          'meta': ['name', 'content', 'charset'],
          'link': ['rel', 'href', 'type']
        },
        // Sadece HTTP(S) ve yerel(file, data) linklere/görsellere izin ver, javascript/vb engelle
        allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'tel', 'file', 'data'],
        allowedSchemesByTag: {
          img: ['http', 'https', 'data', 'file'],
          image: ['http', 'https', 'data', 'file'],
          a: ['http', 'https', 'mailto', 'tel', 'file']
        },
        allowProtocolRelative: false,
        allowIframeRelativeUrls: false
      });
      resolve(cleanHtml);
    }, 0);
  });
};
