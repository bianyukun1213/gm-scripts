// ==UserScript==
// @name         跨站发布博文
// @namespace    a2f8b6c8-5594-453b-9a97-6de2eb1a3c0c
// @version      1.0.1
// @description  从 his2nd.life 文章页面中提取内容发布到其他平台。
// @author       Hollis
// @match        https://his2nd.life/*/posts/*/
// @match        https://localhost:4321/*/posts/*/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=his2nd.life
// @grant        GM_registerMenuCommand
// @run-at       document-end
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

const platforms = ['telegram', 'tg', 'mastodon', 'mt', 'hellotalk', 'ht'];
const i18n = {
    'zh-CN': {
        siteTag: '#他的第二人生',
        title: '标题：',
        id: 'Id：',
        author: '作者：',
        publicationTime: '发布时间：',
        description: '描述：',
        postContent: '正文：',
        link: '链接：',
        telegram: {
            contentLimit: 2000,
            additional: '点击“即时预览”查看全文。'
        },
        mastodon: {
            contentLimit: 600,
            additional: '请注意：您在此对于嘟文的互动会被同步至原文页面。若这不是您期望的行为，请不要互动，或私信联系我删除互动。'
        },
        hellotalk: {
            contentLimit: 1500
        }
    },
    'en-US': {
        siteTag: '#His2ndLife',
        title: 'Title: ',
        id: 'Id: ',
        author: 'Author: ',
        publicationTime: 'Publication time: ',
        description: 'Description: ',
        postContent: 'Content: ',
        link: 'Link: ',
        telegram: {
            contentLimit: 2000,
            additional: 'Click “INSTANT VIEW” to check the full post.'
        },
        mastodon: {
            contentLimit: 200,
            additional: 'Please note: Your interaction with this toot will be synchronized to the original page. If this is not intended, please do not interact, or PM me to delete the interaction.'
        },
        hellotalk: {
            contentLimit: 1000
        }
    }
};
for (const lang in i18n) {
    if (Object.prototype.hasOwnProperty.call(i18n, lang)) {
        const wd = i18n[lang];
        wd.tg = wd.telegram;
        wd.mt = wd.mastodon;
        wd.ht = wd.hellotalk;
    }
}

function getElementByXPath(xpathExpr) {
    const result = document.evaluate(xpathExpr, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    if (result && result.singleNodeValue) {
        return result.singleNodeValue;
    } else {
        return null; // 如果没有找到匹配的元素，则返回null
    }
}

function getPostId() {
    return window.location.href.split('/').slice(-2)[0];
}

function getPageLang() {
    return document.documentElement.lang;
}

function getPostTitle() {
    return document.getElementsByClassName('p-name')[0].textContent;
}

function getAuthor(targetLang) {
    return [...document.querySelectorAll('.p-author .p-name')].map(a => a.textContent).join(targetLang === 'zh-CN' ? '、' : ', ');
}

function getPublicationTime() {
    const date = getElementByXPath('/html/body/main/div/div[1]/div[1]/span');
    return date ? date.textContent.replace(' — ', '') : '';
}

function getDescription() {
    return document.getElementsByClassName('p-summary')[0]?.textContent ?? '';
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
        // 'TABLE',
        // 'TH',
        // 'TD',
        'BLOCKQUOTE',
        // 'HEADER',
        // 'FOOTER',
        // 'NAV',
        // 'SECTION', // 脚注。
        // 'SUMMARY',
        // 'ASIDE', // 被提示使用了，但我不想要提示。
        // 'ARTICLE',
        // 'ADDRESS'
    ];
    let skipClasses = [
        'tide-image-masonry',
        'tide-image-figure',
        'tabs',
        'protected',
        'hidden'
    ];
    skipClasses = new Set(skipClasses);
    const skipHeadings = ['目录', 'Table of contents', '歌单', 'Playlist', '影集'];
    let headingSkipped = false;
    let postContent = '';
    const eles = document.getElementsByClassName('e-content')[0].childNodes;
    let ps = []
    const elesLength = eles.length;
    for (let eleIndex = 0; eleIndex < elesLength; eleIndex++) {
        const ele = eles[eleIndex];
        if (ele.className === 'markdown-heading') {
            if (skipHeadings.filter(h => ele.textContent.includes(h)).length > 0)
                headingSkipped = true;
            else
                headingSkipped = false;
        }
        if (headingSkipped) continue;
        if (wantedTagNames.includes(ele.tagName)) {
            if (ele.classList && [...ele.classList].filter(c => skipClasses.has(c)).length === 0)
                ps.push(ele);
            else if (!ele.classList)
                ps.push(ele);
        }
    }
    for (const p of ps) {
        console.log(p.className)
        postContent += (p.className === 'markdown-heading' ? `\n${p.textContent.trim()}\n\n` : `${p.textContent.trim()}\n`);
    }
    // postContent = postContent.replace(/\n{2,}/g, '\n'); // 移除多个 \n。
    postContent = postContent.replace(/\n{3,}/g, '\n\n'); // 移除多个 \n。
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
        if (!platforms.includes(targetPlatform))
            targetPlatform = 'telegram';
        let targetLang = getPageLang();
        if (!Object.getOwnPropertyNames(i18n).includes(targetLang))
            targetLang = 'zh-CN';
        const wd = i18n[targetLang];
        const contentLimit = wd[targetPlatform].contentLimit;
        let postContent = getPostContent();
        if (postContent.length > contentLimit) // 字数多了的话，m.cmx.im 会 502。
            postContent = UnicodeUtils.slice(postContent, 0, contentLimit).trim() + '…';
        let desc = getDescription();
        if (desc)
            desc = wd.description + desc + '\n\n';
        const additional = wd[targetPlatform].additional;
        const finalText = `${wd.siteTag} #${getPostId()}\n\n${wd.title}${getPostTitle()}\n\n${wd.author}${getAuthor(targetLang)}\n\n${wd.publicationTime}${getPublicationTime()}\n\n${desc}${wd.postContent}\n\n---\n\n${postContent}\n\n---\n\n${wd.link}${getLink(targetPlatform)}${additional ? '\n\n' + additional : ''}`;
        // window.open(`https://m.cmx.im/share?text=${encodeURIComponent(finalText)}`, '_blank'); // 分享接口字数限制更严格。
        const textarea = document.createElement('textarea');
        textarea.innerHTML = finalText;
        textarea.style = 'position:absolute;width:100%;height:100%;z-index:500;background-color:white;';
        document.body.appendChild(textarea);
        if (targetPlatform === 'mastodon' || targetPlatform === 'mt') {
            window.open('https://m.cmx.im/publish', '_blank', 'popup');
        }
    },
    'p'
);
