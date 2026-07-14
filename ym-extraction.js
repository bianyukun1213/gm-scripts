// ==UserScript==
// @name         YouTube Music 歌单信息提取器
// @namespace    4584f753-93f3-4ad2-9087-adcb1077802b
// @version      1.1
// @description  提取 YouTube Music 播放列表中的歌曲名称、歌手、专辑和链接，并复制到剪贴板。
// @author       Hollis
// @match        https://music.youtube.com/*
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    // 核心提取逻辑
    const extractPlaylist = (lang) => {
        const songs = [];
        // 获取所有列表项的容器
        const items = document.querySelectorAll('ytmusic-responsive-list-item-renderer');

        if (items.length === 0) {
            alert('未找到任何歌曲，请确保你在歌单页面并且页面已加载完毕。');
            return;
        }

        items.forEach(item => {
            // 1. 提取歌曲名称和链接
            const titleElement = item.querySelector('.title-column .title a');
            if (!titleElement) return; // 如果没有标题，跳过（可能是无效项）

            const title = titleElement.textContent.trim();
            const url = titleElement.href;

            // 2. 提取歌手和专辑
            const secondaryCols = item.querySelectorAll('.secondary-flex-columns .flex-column yt-formatted-string');

            // 通常第一个是歌手，第二个是专辑。通过 getAttribute('title') 获取避免被省略号截断
            const artist = secondaryCols[0] ? secondaryCols[0].getAttribute('title') : '未知歌手';
            const album = secondaryCols[1] ? secondaryCols[1].getAttribute('title') : '未知专辑';

            songs.push({
                title: title,
                artist: artist,
                album: album,
                url: url
            });
        });

        // 在控制台以表格形式优雅地输出
        console.clear();
        console.log(`成功提取 ${songs.length} 首歌曲：`);
        console.table(songs);

        // 格式化为纯文本并复制到剪贴板
        const textOutput = songs.map((s, index) => {
            if (lang === 'CN')
                return `${index + 1}. ${s.artist} 的“${s.title}”，发行于专辑 *${s.album}*`
            else if (lang === 'EN')
                return `${index + 1}. “${s.title}” by ${s.artist} in album *${s.album}*`
        }).join('\n');

        GM_setClipboard(textOutput);
        alert(`成功提取 ${songs.length} 首歌曲！\n信息已复制到剪贴板，您也可以按 F12 在控制台查看详细表格。`);
    };

    const extractPlaylistCn = () => extractPlaylist('CN')
    const extractPlaylistEn = () => extractPlaylist('EN')

    // 注册油猴菜单命令
    GM_registerMenuCommand("提取当前歌单（CN）", extractPlaylistCn);
    GM_registerMenuCommand("提取当前歌单（EN）", extractPlaylistEn);

})();