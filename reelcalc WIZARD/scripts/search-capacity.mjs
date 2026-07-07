const queries = process.argv.slice(2);

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return decodeEntities(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

for (const query of queries) {
  const url = "https://www.bing.com/search?format=rss&q=" + encodeURIComponent(query);
  const xml = await fetch(url).then((response) => response.text());
  console.log("\nQUERY", query);
  const matches = xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<description>([\s\S]*?)<\/description>/g);
  for (const match of matches) {
    console.log("-", stripTags(match[1]));
    console.log(" ", stripTags(match[2]));
    console.log(" ", stripTags(match[3]).slice(0, 260));
  }
}
