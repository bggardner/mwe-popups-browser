/*
 * Standalone version of https://github.com/wikimedia/mediawiki-extensions-Popups
 */

class MwePopups {
  static endpoint = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
  static hrefPrefix = 'https://en.wikipedia.org/wiki/';
  static userAgent;

  constructor(userAgent, config = {}) {
    if (!userAgent) { throw 'userAgent is required. See https://en.wikipedia.org/api/rest_v1/'; }
    this.constructor.userAgent = userAgent;
    if (config.hasOwnProperty('endpoint')) {
      this.constructor.endpoint = config['endpoint'];
    }
    if (config.hasOwnProperty('href_prefix')) {
      this.constructor.hrefPrefix = config['href_prefix'];
    }
    // https://github.com/wikimedia/mediawiki-extensions-Popups/blob/master/src/index.js
    const generateToken = function() {
      let token = '';
      for (let i = 0; i < 40; i++) {
        token += Math.round(Math.random() * 255).toString(16).padStart(2, '0');
      }
      return token;
    }
    const boundActions = MwePopupsActions;
    boundActions.boot();
    const validLinkSelector = `a[href^="${this.constructor.hrefPrefix}"]`;
    MwePopupsUiRenderer.init();
    document.querySelectorAll(validLinkSelector).forEach(element => {
      element.addEventListener('mouseover', function(event) {
        const mwTitle = MwePopups.titleFromElement(this);
        if (!mwTitle) { return; }
        const type = MwePopupsPreviewModel.previewTypes.TYPE_PAGE;
        let gateway;
        switch (type) {
          case MwePopupsPreviewModel.previewTypes.TYPE_PAGE:
            //gateway = pagePreviewGateway;
            break;
          case MwePopupsPreviewModel.previewTypes.TYPE_REFERENCE:
            return; // TODO
            break;
          default:
            return;
        }
        const measures = {
          pageX: event.pageX,
          pageY: event.pageY,
          clientY: event.clientY,
          width: this.getClientRects()[0].width,
          height: this.getClientRects()[0].height,
          offset: this.offset(),
          clientRects: this.getClientRects(),
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          scrollTop: document.documentElement.scrollTop
        };
        boundActions.linkDwell(mwTitle, this, measures, gateway, generateToken, type);
      });
      element.addEventListener('mouseout', function() {
        const mwTitle = MwePopups.titleFromElement(this);
        if (mwTitle) {
          boundActions.abandon();
        }
      });
      element.addEventListener('click', function() {
        const mwTitle = MwePopups.titleFromElement(this);
        if (mwTitle) {
          if (MwePopUpsPreviewModel.previewTypes.TYPE_PAGE === MwePopupsPreviewModel.previewTypes.TYPE_PAGE) {
            boundActions.linkClick(this);
          }
        }
      });
    });
  }

  static titleFromElement(el) {
    return el.href.substr(MwePopups.hrefPrefix.length);
  }
}

// Replaces functionality of https://github.com/wikimedia/mediawiki-extensions-Popups/blob/master/src/actions.js
class MwePopupsActions {

  static FETCH_START_DELAY = 150;
  static PREVIEW_SEEN_DURATION = 1000;
  static FETCH_COMPLETE_TARGET_DELAY = 350 + this.FETCH_START_DELAY;
  static FETCH_DELAY_REFERENCE_TYPE = 150;
  static ABANDON_END_DELAY = 300;

  static types = {
    BOOT: 'BOOT',
    LINK_DWELL: 'LINK_DWELL',
    ABANDON_START: 'ABANDON_START',
    ABANDON_END: 'ABANDON_END',
    LINK_CLICK: 'LINK_CLICK',
    FETCH_START: 'FETCH_START',
    FETCH_END: 'FETCH_END',
    FETCH_COMPLETE: 'FETCH_COMPLETE',
    FETCH_FAILED: 'FETCH_FAILED',
    FETCH_ABORTED: 'FETCH_ABORTED',
    PAGEVIEW_LOGGED: 'PAGEVIEW_LOGGED',
    PREVIEW_DWELL: 'PREVIEW_DWELL',
    PREVIEW_SHOW: 'PREVIEW_SHOW',
    PREVIEW_CLICK: 'PREVIEW_CLICK',
    PREVIEW_SEEN: 'PREVIEW_SEEN',
    SETTINGS_SHOW: 'SETTINGS_SHOW',
    SETTINGS_HIDE: 'SETTINGS_HIDE',
    SETTINGS_CHANGE: 'SETTINGS_CHANGE',
    EVENT_LOGGED: 'EVENT_LOGGED',
    STATSV_LOGGED: 'STATSV_LOGGED'
  };

  static openTimeout = Number.NaN;
  static closeTimeout = Number.NaN;
  static state;
  static preview;

  static boot() {
    MwePopupsActions.state = MwePopupsActions.types.BOOT;
  }

  static fetch(gateway, title, el, token, type) {
    MwePopupsActions.state = MwePopupsActions.types.FETCH_START;
    return fetch(MwePopups.endpoint + title, {
      'Accept': 'application/json; charset=utf-8; profile="https://www.mediawiki.org/wiki/Specs/Summary/1.4.2"',
      'User-Agent': MwePopups.userAgent
    }).then(response => response.json()).then(page => {
      MwePopupsActions.state = MwePopupsActions.types.FETCH_COMPLETE;
      return MwePopupsPreviewModel.createModel(
        page.title,
        page.content_urls.desktop.page,
        page.lang,
        page.dir,
        page.extract_html,
        page.type,
        page.thumbnail,
        page.pageid
      );
    }).catch(error => {
      MwePopupsActions.state = MwePopupsActions.types.FETCH_FAILED;
      console.log(error);
    });
  }

  static linkDwell(title, el, measures, gateway, generateToken, type) {
    MwePopupsActions.state = MwePopupsActions.types.LINK_DWELL;
    const token = generateToken();
    if (!isNaN(MwePopupsActions.closeTimeout)) {
      clearTimeout(MwePopupsActions.closeTimeout);
      MwePopupsActions.closeTimeout = Number.NaN;
    }
    if (!isNaN(MwePopupsActions.openTimeout)) { return; }
    if (MwePopupsActions.preview != undefined) {
      if (MwePopupsActions.preview.el == el) {
        return;
      } else {
        MwePopupsActions.preview.hide();
      }
    }
    MwePopupsActions.openTimeout = setTimeout(function() {
      MwePopupsActions.openTimeout = Number.NaN;
      MwePopupsActions.fetch(gateway, title, el, token, type).then(model => {
        MwePopupsActions.preview = MwePopupsUiRenderer.render(model);
        MwePopupsActions.preview.show(measures, MwePopupsActions, token);
      });
    }, MwePopupsActions.FETCH_COMPLETE_TARGET_DELAY - MwePopupsActions.FETCH_START_DELAY);
  }

  static abandon() {
    MwePopupsActions.state = MwePopupsActions.types.ABANDON_START;
    if (!isNaN(MwePopupsActions.openTimeout)) {
      clearTimeout(MwePopupsActions.openTimeout);
      MwePopupsActions.openTimeout = Number.NaN;
      MwePopupsActions.state = MwePopupsActions.types.ABANDON_END;
      return;
    }
    if (!isNaN(MwePopupsActions.closeTimeout)) { return; }
    MwePopupsActions.closeTimeout = setTimeout(function() {
      MwePopupsActions.closeTimeout = Number.NaN;
      MwePopupsActions.preview.hide();
      MwePopupsActions.state = MwePopupsActions.types.ABANDON_END;
    }, MwePopupsActions.ABANDON_END_DELAY);
  }

  static linkClick(el) {
    MwePopupsActions.state = MwePopupsActions.types.LINK_CLICK;
  }

  static previewDwell() {
    MwePopupsActions.state = MwePopupsActions.types.PREVIEW_DWELL;
    if (isNaN(MwePopupsActions.closeTimeout)) { return; }
    clearTimeout(MwePopupsActions.closeTimeout);
    MwePopupsActions.closeTimeout = NaN;
  }

  static previewShow(token) {
    MwePopupsActions.state = MwePopupsActions.types.PREVIEW_SHOW;
    clearTimeout(MwePopupsActions.closeTimeout);
    MwePopupsActions.closeTimeout = setTimeout(function() {
      MwePopupsActions.closeTimeout = Number.NaN;
      if (MwePopupsActions.state == MwePopupsActions.types.ABANDON_START) {
        MwePopupsActions.state = MwePopupsActions.types.PREVIEW_SEEN;
        return MwePopupsActions.abandon();
      }
      MwePopupsActions.state = MwePopupsActions.types.PREVIEW_SEEN;
    }, MwePopupsActions.PREVIEW_SEEN_DURATION);
  }
}

// https://github.com/wikimedia/mediawiki-extensions-Popups/blob/master/src/preview/model.js
class MwePopupsPreviewModel {
  static previewTypes = {
    TYPE_GENERIC: 'generic',
    TYPE_PAGE: 'page',
    TYPE_DISAMBIGUATION: 'disambiguation',
    TYPE_REFERENCE: 'reference'
  };

  static createModel(title, url, languageCode, languageDirection, extract, type, thumbnail, pageId) {
    const processedExtract = this.processExtract(extract),
      previewType = this.getPagePreviewType(type, processedExtract);
    return {
      title,
      url,
      languageCode,
      languageDirection,
      extract: processedExtract,
      type: previewType,
      thumbnail,
      pageId
    };
  }

  static processExtract(extract) {
    if (extract === undefined || extract === null || extract.length === 0) {
      return undefined;
    }
    return extract;
  }

  static getPagePreviewType(type, processedExtract) {
    if (processedExtract === undefined) {
      return this.previewTypes.TYPE_GENERIC;
    }
    switch(type) {
      case this.previewTypes.TYPE_GENERIC:
      case this.previewTypes.TYPE_DISAMBIGUATION:
      case this.previewTypes.TYPE_PAGE:
        return type;
      default:
        return this.previewTypes.TYPE_PAGE;
    }
  }
}

// https://github.com/wikimedia/mediawiki-extensions-Popups/blob/master/src/constants.js
class MwePopupsConstants {
  // https://github.com/wikimedia/mediawiki-extensions-Popups/blob/master/src/bracketedPixelRatio.js
  static bpr(dpr = window.devicePixelRatio) {
    if (!dpr) { return 1; }
    if (dpr > 1.5) { return 2; }
    if (dpr > 1) { return 1.5; }
    return 1;
  }

  static BRACKETED_DEVICE_PIXEL_RATIO = this.bpr()
  static THUMBNAIL_SIZE = 320 * this.bpr();
  static EXTRACT_LENGTH = 525;
}

// https://github.com/wikimedia/mediawiki-extensions-Popups/blob/master/src/ui/renderer.js
class MwePopupsUiRenderer {
  static landscapePopupWidth = 450;
  static portraitPopupWidth = 320;
  static pointerSize = 8; // Height of pointer.
  static maxLinkWidthForCenteredPointer = 28; // Link with roughly < 4 chars.

  static createPointerMasks(container) {
    let d = document.createElement('div');
    d.id = 'mwe-popups-svg';
    // https://github.com/wikimedia/mediawiki-extensions-Popups/blob/master/src/ui/pointer-mask.svg
    d.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">
  <defs>
    <!-- This mask's pointer is left-aligned and points to the top. -->
    <clipPath id="mwe-popups-mask">
      <path d="M0 8h10l8-8 8 8h974v992H0z"/>
    </clipPath>
    <!-- This mask's pointer is right-aligned (relative to a 320 wide rectangle) and points to the top. "flip" means horizontally flipped here! -->
    <clipPath id="mwe-popups-mask-flip">
      <path d="M0 8h294l8-8 8 8h690v992H0z"/>
    </clipPath>
    <!-- This mask's pointer is right-aligned (relative to a 200 wide rectangle) and points to the top. -->
    <clipPath id="mwe-popups-landscape-mask">
      <path d="M0 8h174l8-8 8 8h810v992H0z"/>
    </clipPath>
    <!-- This mask's pointer is right-aligned (relative to a 200 x 250 rectangle) and points to the bottom. "flip" means vertically flipped here! -->
    <clipPath id="mwe-popups-landscape-mask-flip">
      <path d="M0 0h1000v242H190l-8 8-8-8H0z"/>
    </clipPath>
  </defs>
</svg>`;
    container.append(d);
  }

  static init() {
    this.createPointerMasks(document.body);
  }

  static render(model) {
    const preview = this.createPreviewWithType(model);
    return {
      show(event, boundActions, token) {
        return MwePopupsUiRenderer.show(preview, event, boundActions, token, document.body, document.documentElement.getAttribute('dir'));
      },
      hide() {
        return MwePopupsUiRenderer.hide(preview);
      }
    }
  }

  static createPreviewWithType(model) {
    switch (model.type) {
      case MwePopupsPreviewModel.previewTypes.TYPE_PAGE:
        return this.createPagePreview(model);
      case MwePopupsPreviewModel.previewTypes.TYPE_DISAMBIGUATION:
        return this.createDisambiguationPreview(model);
      case MwePopupsPreviewModel.previewTypes.TYPE_REFERENCE:
        return this.createReferencePreview(model);
      default:
        return this.createEmptyPreview(model);
    }
  }

  static createPagePreview(model) {
    const thumbnail = MwePopupsUiThumbnail.createThumbnail(model.thumbnail),
      hasThumbnail = thumbnail !== null;

    return {
      el: MwePopupsUiPagePreview.renderPagePreview(model, thumbnail),
      hasThumbnail,
      thumbnail,
      isTall: hasThumbnail && thumbnail.isTall
    }
  }

  static createEmptyPreview(model) {} //TODO
  static createDisambiguationPreview(model) {} //TODO
  static createReferencePreview(model) {} //TODO

  static show(preview, measures, behavior, token, container, dir) {
    const layout = this.createLayout(preview.isTall, measures, this.pointerSize, dir);
    container.append(preview.el);
    this.layoutPreview(preview, layout, this.getClasses(preview, layout), MwePopupsUiThumbnail.SIZES.landscapeImage.h, this.pointerSize, measures.windowHeight);
    preview.el.style.display = 'block';
    if (preview.el.classList.contains('mwe-popups-type-reference')) {
      preview.el.querySelector('.mwe-popups-scroll').dispatchEvent(new CustomEvent('scroll'));
    }
    new Promise(resolve => setTimeout(resolve, 200)).then(() => {
      this.bindBehavior(preview, behavior);
      behavior.previewShow(token);
    });
  }

  static bindBehavior(preview, behavior) {
    preview.el.addEventListener('mouseenter', behavior.previewDwell);
    preview.el.addEventListener('mouseleave', behavior.abandon);
    preview.el.addEventListener('click', behavior.click);
    // Not supporting settings
  }

  static hide(preview) {
    const fadeInClass = preview.el.classList.contains('mwe-popups-fade-in-up') ? 'mwe-popups-fade-in-up' : 'mwe-popups-fade-in-down';
    const fadeOutClass = fadeInClass === 'mwe-popups-fade-in-up' ? 'mwe-popups-fade-out-down' : 'mwe-popups-fade-out-up';
    preview.el.classList.remove(fadeInClass);
    preview.el.classList.add(fadeOutClass);
    new Promise(resolve => setTimeout(resolve, 150)).then(() => preview.el.remove());
  }

  static createLayout(isPreviewTall, measures, pointerSpaceSize, dir) {
    let flippedX = false,
      flippedY = false,
      offsetTop = measures.pageY ? this.getClosestYPosition(measures.pageY - measures.scrollTop, measures.clientRects, false) + measures.scrollTop + pointerSpaceSize : measures.offset.top + measures.height + this.pointerSize,
      offsetLeft;
    const clientTop = measures.clientY ? measures.clientY : offsetTop;

    if ( measures.pageX ) {
      if ( measures.width > this.maxLinkWidthForCenteredPointer ) {
        offsetLeft = measures.pageX;
      } else {
        offsetLeft = measures.offset.left + measures.width / 2;
      }
    } else {
      offsetLeft = measures.offset.left;
    }

    if ( offsetLeft > ( measures.windowWidth / 2 ) ) {
      offsetLeft += ( !measures.pageX ) ? measures.width : 0;
      offsetLeft -= !isPreviewTall ? this.portraitPopupWidth : this.landscapePopupWidth;
      flippedX = true;
    }

    if ( measures.pageX ) {
      offsetLeft += ( flippedX ) ? 18 : -18;
    }

    if ( clientTop > ( measures.windowHeight / 2 ) ) {
      flippedY = true;
      offsetTop = measures.offset.top;
      if ( measures.pageY ) {
        offsetTop = this.getClosestYPosition(measures.pageY - measures.scrollTop, measures.clientRects, true) + measures.scrollTop;
      }

      offsetTop -= pointerSpaceSize;
    }

    return {
      offset: {
        top: offsetTop,
        left: offsetLeft
      },
      flippedX: dir === 'rtl' ? !flippedX : flippedX,
      flippedY,
      dir
    };
  }

  static getClasses(preview, layout) {
    const classes = [];

    if ( layout.flippedY ) {
      classes.push( 'mwe-popups-fade-in-down' );
    } else {
      classes.push( 'mwe-popups-fade-in-up' );
    }

    if ( layout.flippedY && layout.flippedX ) {
      classes.push( 'flipped-x-y' );
    } else if ( layout.flippedY ) {
      classes.push( 'flipped-y' );
    } else if ( layout.flippedX ) {
      classes.push( 'flipped-x' );
    }

    if ( ( !preview.hasThumbnail || preview.isTall && !layout.flippedX ) &&
      !layout.flippedY ) {
      classes.push( 'mwe-popups-no-image-pointer' );
    }

    if ( preview.hasThumbnail && !preview.isTall && !layout.flippedY ) {
      classes.push( 'mwe-popups-image-pointer' );
    }

    if ( preview.isTall ) {
      classes.push( 'mwe-popups-is-tall' );
    } else {
      classes.push( 'mwe-popups-is-not-tall' );
    }

    return classes;
  }

  static layoutPreview(preview, layout, classes, predefinedLandscapeImageHeight, pointerSpaceSize, windowHeight) {
    const popup = preview.el,
      isTall = preview.isTall,
      hasThumbnail = preview.hasThumbnail,
      thumbnail = preview.thumbnail,
      flippedY = layout.flippedY;

    if (!flippedY && !isTall && hasThumbnail && thumbnail.height < predefinedLandscapeImageHeight) {
      popup.querySelector( '.mwe-popups-extract' ).style.marginTop = `${thumbnail.height - pointerSpaceSize}px`;
    }

    popup.classList.add(...classes);
    popup.style.left = `${layout.offset.left}px`;
    popup.style.top = flippedY ? 'auto' : `${layout.offset.top}px`;;
    popup.style.bottom = flippedY ? `${windowHeight - layout.offset.top}px` : 'auto';

    if (hasThumbnail) {
      this.setThumbnailClipPath(preview, layout);
    }
  }

  static setThumbnailClipPath({el, isTall, thumbnail }, {flippedY, flippedX, dir }) {
    const maskID = this.getThumbnailClipPathID(isTall, flippedY, flippedX);
    if (maskID) {
      const matrix = {
        scaleX: 1,
        translateX: isTall ? Math.min(thumbnail.width - MwePopupsUiThumbnail.SIZES.portraitImage.w, 0) : 0
      };

      if (dir === 'rtl') {
        matrix.scaleX = -1;
        matrix.translateX = isTall ? MwePopupsUiThumbnail.SIZES.portraitImage.w : MwePopupsUiThumbnail.SIZES.landscapeImage.w;
      }

      const mask = document.getElementById(maskID);
      mask.setAttribute(
        'transform',
        `matrix(${matrix.scaleX} 0 0 1 ${matrix.translateX} 0)`
      );

      el.querySelector('image').setAttribute('clip-path', `url(#${maskID})`);
    }
  }

  static getThumbnailClipPathID( isTall, flippedY, flippedX ) {
    if ( !isTall && !flippedY ) {
      return flippedX ? 'mwe-popups-mask-flip' : 'mwe-popups-mask';
    } else if ( isTall && flippedX ) {
      return flippedY ? 'mwe-popups-landscape-mask-flip' : 'mwe-popups-landscape-mask';
    }

    return undefined;
  }

  static getClosestYPosition(y, rects, isTop) {
    let minY = null,
      result;
    Array.prototype.slice.call(rects).forEach(rect => {
      const deltaY = Math.abs(y - rect.top + y - rect.bottom);
      if (minY === null || minY > deltaY) {
        minY = deltaY;
        result = isTop ? Math.floor(rect.top) : Math.ceil(rect.bottom);
      }
    });
    return result;
  }
}

// https://github.com/wikimedia/mediawiki-extensions-Popups/blob/master/src/ui/thumbnail.js
class MwePopupsUiThumbnail {
  static SIZES = {
    portraitImage: {
      h: 250, // Exact height
      w: 203 // Max width
    },
    landscapeImage: {
      h: 200, // Max height
      w: 320 // Exact Width
    }
  }

  static createThumbnail( rawThumbnail ) {
    const devicePixelRatio = MwePopupsConstants.BRACKETED_DEVICE_PIXEL_RATIO;

    if ( !rawThumbnail ) {
      return null;
    }

    const tall = rawThumbnail.width < rawThumbnail.height;
    const thumbWidth = rawThumbnail.width / devicePixelRatio;
    const thumbHeight = rawThumbnail.height / devicePixelRatio;

  if (
    // Image too small for landscape display
    ( !tall && thumbWidth < this.SIZES.landscapeImage.w ) ||
    // Image too small for portrait display
    ( tall && thumbHeight < this.SIZES.portraitImage.h ) ||
    // These characters in URL that could inject CSS and thus JS
    (
      rawThumbnail.source.indexOf( '\\' ) > -1 ||
      rawThumbnail.source.indexOf( '\'' ) > -1 ||
      rawThumbnail.source.indexOf( '"' ) > -1
    )
  ) {
    return null;
  }

  let x, y, width, height;
  if ( tall ) {
    x = ( thumbWidth > this.SIZES.portraitImage.w ) ?
      ( ( thumbWidth - this.SIZES.portraitImage.w ) / -2 ) :
      ( this.SIZES.portraitImage.w - thumbWidth );
    y = ( thumbHeight > this.SIZES.portraitImage.h ) ?
      ( ( thumbHeight - this.SIZES.portraitImage.h ) / -2 ) : 0;
    width = this.SIZES.portraitImage.w;
    height = this.SIZES.portraitImage.h;

    // Special handling for thin tall images
    // https://phabricator.wikimedia.org/T192928#4312088
    if ( thumbWidth < width ) {
      x = 0;
      width = thumbWidth;
    }
  } else {
    x = 0;
    y = ( thumbHeight > this.SIZES.landscapeImage.h ) ?
      ( ( thumbHeight - this.SIZES.landscapeImage.h ) / -2 ) : 0;
    width = this.SIZES.landscapeImage.w;
    height = ( thumbHeight > this.SIZES.landscapeImage.h ) ?
      this.SIZES.landscapeImage.h : thumbHeight;
  }

  const isNarrow = tall && thumbWidth < this.SIZES.portraitImage.w;

  return {
    el: this.createThumbnailElement(
      tall ? 'mwe-popups-is-tall' : 'mwe-popups-is-not-tall',
      rawThumbnail.source,
      x,
      y,
      thumbWidth,
      thumbHeight,
      width,
      height
    ),
    isTall: tall,
    isNarrow,
    offset: isNarrow ? this.SIZES.portraitImage.w - thumbWidth : 0,
    width: thumbWidth,
    height: thumbHeight
  };
}

  static createThumbnailElement(className, url, x, y, thumbnailWidth, thumbnailHeight, width, height) {
    const nsSvg = 'http://www.w3.org/2000/svg',
      nsXlink = 'http://www.w3.org/1999/xlink';

    const line = document.createElementNS(nsSvg, 'polyline');
    const isTall = className.indexOf('not-tall') === -1;
    const points = isTall ? [ 0, 0, 0, height ] : [ 0, height - 1, width, height - 1 ];

    line.setAttribute('stroke', 'rgba(0,0,0,0.1)');
    line.setAttribute('points', points.join(' '));
    line.setAttribute('stroke-width', 1);

    const thumbnailSVGImage = document.createElementNS(nsSvg, 'image');
    thumbnailSVGImage.setAttributeNS(nsXlink, 'href', url);
    thumbnailSVGImage.classList.add(className);
    thumbnailSVGImage.setAttribute('x', x);
    thumbnailSVGImage.setAttribute('y', y);
    thumbnailSVGImage.setAttribute('width', thumbnailWidth);
    thumbnailSVGImage.setAttribute('height', thumbnailHeight);

    const thumbnail = document.createElementNS( nsSvg, 'svg' );
    thumbnail.xmlns = nsSvg;
    thumbnail.setAttribute('width', width);
    thumbnail.setAttribute('height', height);
    thumbnail.append(thumbnailSVGImage);
    thumbnail.append(line);
    return thumbnail;
  }
}

// https://github.com/wikimedia/mediawiki-extensions-Popups/blob/master/src/ui/templates/templateUtil.js
class MwePopupsUiTemplateUtil {
  static templates = {};

  static createNodeFromTemplate(html) {
    if (!this.templates[html]) {
      const div = document.createElement('div');
      div.innerHTML = html;
      this.templates[html] = div.firstElementChild;
    }
    return this.templates[html].cloneNode(true);
  }
}

// https://github.com/wikimedia/mediawiki-extensions-Popups/blob/master/src/ui/templates/popup/popup.js
class MwePopupsUiPopup {
  static templateHTML = `
    <div class="mwe-popups" aria-hidden></div>
`;

  static renderPopup(type, container) {
    const element = MwePopupsUiTemplateUtil.createNodeFromTemplate(this.templateHTML);
    element.className = `mwe-popups mwe-popups-type-${type}`;
    container.className = 'mwe-popups-container';
    element.appendChild(container);
    return element;
  }
}

// https://github.com/wikimedia/mediawiki-extensions-Popups/blob/master/src/ui/templates/pagePreview/pagePreview.js
class MwePopupsUiPagePreview {
  static defaultExtractWidth = 215;
  static templateHTML = `
<div>
    <a class="mwe-popups-discreet"></a>
    <a class="mwe-popups-extract"></a>
    <footer>
        <a class="mwe-popups-settings-icon">
            <span class="mw-ui-icon mw-ui-icon-element mw-ui-icon-small mw-ui-icon-settings"></span>
        </a>
    </footer>
</div>
    `;

  static renderPagePreview(model, thumbnail) {
    const el = MwePopupsUiPopup.renderPopup(model.type, MwePopupsUiTemplateUtil.createNodeFromTemplate(this.templateHTML));
    el.querySelector('.mwe-popups-discreet').href = model.url;
    el.querySelector('.mwe-popups-extract').href = model.url;
    el.querySelector('.mwe-popups-extract').dir = model.languageDirection;
    el.querySelector('.mwe-popups-extract').lang = model.languageCode;
    if (thumbnail) {
      el.querySelector('.mwe-popups-discreet').append(thumbnail.el);
    } else {
      el.querySelector('.mwe-popups-discreet').remove();
    }
    if (model.extract) {
      const extractWidth = this.getExtractWidth(thumbnail);
      el.querySelector('.mwe-popups-extract').style.width = `${extractWidth}px`;
      el.querySelector('.mwe-popups-extract').innerHTML = model.extract;
      el.querySelector('footer').style.width = `${extractWidth}px`;
    }
    return el;
  }

  static getExtractWidth(thumbnail) {
    return thumbnail && thumbnail.isNarrow ? `${this.defaultExtractWidth + thumbnail.offset}px` : '';
  }
}

/* jQuery polyfill */
HTMLElement.prototype.offset = function() {
  let offsetLeft = this.offsetLeft,
    offsetTop = this.offsetTop,
    parentObj = this.offsetParent;
  while (parentObj != null) {
    offsetLeft += parentObj.offsetLeft;
    offsetTop += parentObj.offsetTop;
    parentObj = parentObj.offsetParent;
  }
  return {'left': offsetLeft, 'top': offsetTop};
}
