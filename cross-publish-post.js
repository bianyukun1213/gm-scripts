// ==UserScript==
// @name         跨站发布博文
// @namespace    https://github.com/bianyukun1213
// @version      2025-10-19
// @description  从 his2nd.life 文章页面中提取内容发布到其他平台。
// @author       Hollis
// @match        https://his2nd.life/*/posts/*.html
// @match        https://8000.cs.nas.yinhe.dev:9981/*/posts/*.html
// @icon         https://www.google.com/s2/favicons?sz=64&domain=his2nd.life
// @grant        GM_registerMenuCommand
// ==/UserScript==

'use strict';

// https://moyuscript.github.io/MoyuScript/2024/04/17/handle-unicode-in-js/
class UnicodeUtils {
    // 按 Unicode 码位分割
    static split(str) {
        const arr = [];
        let index = 0;
        while (index < str.length) {
            const codePoint = str.codePointAt(index);
            let char = str[index];
            // 如果 codePoint >= 0x10000，说明是两个码元的字符
            if (codePoint >= 0x10000)
                char += str[index + 1];
            index += char.length;
            arr.push(char);
        }
        return arr;
    }
    static count(str) {
        return this.split(str).length;
    }
    static slice(str, start, end) {
        return this.split(str).slice(start, end).join('');
    }
}

const platforms = ['mastodon', 'mt', 'telegram', 'tg'];
const i18n = {
    'zh-CN': {
        siteTag: '#他的第二人生',
        title: '标题：',
        id: 'Id：',
        author: '作者：',
        publicationTime: '发布时间：',
        description: '描述：',
        excerpt: '摘录：',
        postContent: '正文：',
        link: '链接：',
        mastodon: {
            contentLimit: 600,
            additional: '请注意：您在此对于嘟文的互动会被同步至原文页面。若这不是您期望的行为，请不要互动，或私信联系我删除互动。'
        },
        telegram: {
            contentLimit: 400,
            additional: '点击“即时预览”查看全文。'
        }
    },
    en: {
        siteTag: '#His2ndLife',
        title: 'Title: ',
        id: 'Id: ',
        author: 'Author: ',
        publicationTime: 'Publication time: ',
        description: 'Description: ',
        excerpt: 'Excerpt: ',
        postContent: 'Content: ',
        link: 'Link: ',
        mastodon: {
            contentLimit: 10,
            additional: 'Please note: Your interaction with this toot will be synchronized to the original page. If this is not intended, please do not interact, or PM me to delete the interaction.'
        },
        telegram: {
            contentLimit: 600,
            additional: 'Click “INSTANT VIEW” to check the full post.'
        }
    }
};
for (const lang in i18n) {
    if (Object.prototype.hasOwnProperty.call(i18n, lang)) {
        const wd = i18n[lang];
        wd.mt = wd.mastodon;
        wd.tg = wd.telegram;
    }
}

function getPostId() {
    return window.location.href.split('/').pop().split('.')[0];
}

function getPageLang() {
    return document.documentElement.lang;
}

function getPostTitle() {
    return document.getElementById('tide-page-title').innerText;
}

function getAuthor() {
    return document.getElementsByClassName('tide-post-meta-author')[0].innerText;
}

function getPublicatioinTime() {
    return document.getElementsByClassName('tide-post-meta-date')[0].innerText;
}

function getDescription() {
    return document.getElementsByClassName('tide-post-meta-description')[0]?.innerText ?? '';
}

function getExcerpt() {
    return document.getElementById('more').previousElementSibling.innerText;
}

function getPostContent() {
    const wantedTagNames = [
        'P',
        'DIV',
        'BR',
        'HR',
        'TITLE',
        'H1',
        'H2',
        'H3',
        'H4',
        'H5',
        'H6',
        'OL',
        'UL',
        'LI',
        'PRE',
        'TABLE',
        'TH',
        'TD',
        'BLOCKQUOTE',
        'HEADER',
        'FOOTER',
        'NAV',
        'SECTION',
        'SUMMARY',
        'ASIDE',
        'ARTICLE',
        'ADDRESS'
    ];
    const skipClasses = [
        // 'alertbox alertbox-info',
        // 'alertbox alertbox-warning',
        // 'alertbox alertbox-danger',
        'image-masonry',
        'tide-image-figure',
        'tag-common tabs'
    ];
    let postContent = '';
    const eles = document.getElementsByClassName('e-content')[0].childNodes;
    let ps = []
    let moreFound = false;
    const elesLength = eles.length;
    for (let eleIndex = 0; eleIndex < elesLength; eleIndex++) {
        const ele = eles[eleIndex];
        if (ele.id === 'more') {
            moreFound = true;
            continue;
        }
        else if (wantedTagNames.includes(ele.tagName) && !skipClasses.includes(ele.className) && moreFound) {
            ps.push(ele);
        }
    }
    for (const p of ps) {
        // postContent += (p.innerText.trim() + '\n'); // 用原生的 innerText 而不是 jQuery 的 text()，后者会去除中间的 \n。
        postContent += (p.innerText.trim() + '\n\n'); // 用原生的 innerText 而不是 jQuery 的 text()，后者会去除中间的 \n。
    }
    // postContent = postContent.replace(/\n{2,}/g, '\n'); // 移除多个 \n。
    postContent = postContent.replace(/\n{3,}/g, '\n'); // 移除多个 \n。
    postContent = postContent.replace(/\n+$/, ''); // 移除首 \n。
    postContent = postContent.replace(/^\n+/, ''); // 移除尾 \n。
    return postContent;
}

function getLink(targetPlatform) {
    let link = window.location.href.replace('8000.cs.nas.yinhe.dev:9981', 'his2nd.life');
    if (targetPlatform === 'telegram' || targetPlatform === 'tg') {
        link = `https://t.me/iv?url=${encodeURIComponent(link)}&rhash=1fb363bb9c9cab`;
    }
    return link;
}

GM_registerMenuCommand(
    '发布文章',
    function () {
        let targetPlatform = prompt('输入发布平台');
        if (targetPlatform === null) return;
        let targetLang = getPageLang();
        if (!Object.getOwnPropertyNames(i18n).includes(targetLang))
            targetLang = 'zh-CN';
        const wd = i18n[targetLang];
        if (!platforms.includes(targetPlatform))
            targetPlatform = 'mastodon';
        const contentLimit = wd[targetPlatform].contentLimit;
        let postContent = getPostContent();
        if (postContent.length > contentLimit) // 字数多了的话，m.cmx.im 会 502。
            postContent = UnicodeUtils.slice(postContent, 0, contentLimit).trim() + '…';
        let desc = getDescription();
        if (desc)
            desc = wd.description + desc + '\n\n';
        const additional = wd[targetPlatform].additional;
        const finalText = `${wd.siteTag} #${getPostId()}\n\n${wd.title}${getPostTitle()}\n\n${wd.author}${getAuthor()}\n\n${wd.publicationTime}${getPublicatioinTime()}\n\n${desc}${wd.excerpt}${getExcerpt()}\n\n${wd.postContent}\n\n---\n\n${postContent}\n\n---\n\n${wd.link}${getLink(targetPlatform)}${additional ? '\n\n' + additional : ''}`;
        // window.open(`https://m.cmx.im/share?text=${encodeURIComponent(finalText)}`, '_blank'); // 分享接口字数限制更严格。
        const textarea = document.createElement('textarea');
        textarea.innerHTML = finalText;
        textarea.style = 'position:absolute;width:100%;height:100%;z-index:500;';
        document.documentElement.appendChild(textarea);
        if (targetPlatform === 'mastodon') {
            window.open('https://m.cmx.im/publish', '_blank', 'popup');
        }
    },
    'p'
);
