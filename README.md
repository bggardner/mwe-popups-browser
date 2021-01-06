# mwe-popups-browser
Browserified version of [mediawiki-extensions-Popups](http://github.com/wikimedia/mediawiki-extensions-Popups)

# Usage
By default, all links starting with `https://en.wikipedia.org/wiki/` will attempt to fetch and display a [Wikipedia Page Preview](https://www.mediawiki.org/wiki/Page_Previews).
```html
<a href="https://en.wikipedia.org/wiki/Wikipedia">Wikipedia</a>
<script>
document.addEventListener('DOMContentLoaded', event => {
  new MwePopups('username@host.com'); // Or contact page URL, see https://en.wikipedia.org/api/rest_v1/
});
</script>
```
The `href` prefix and Page Preview API endpoint can be customized by passing a configuration argument to the constructor.
```html
<a href="https://en.wikipedia.org/wiki/Wikipedia">Wikipedia</a>
<script>
document.addEventListener('DOMContentLoaded', event => {
  new MwePopups('username@host.com', {
    href_prefix: 'http://mysite.com/path/',
    endpoint: 'https://host/api/' // Remainder of link (after prefix) will be appended to the endpoint
  });
});
</script>
```
