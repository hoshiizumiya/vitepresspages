<template>
    <div style="margin-top: 2rem">
        <Giscus id="comments"
                :key="route.path"
                repo="hoshiizumiya/vitepresspages"
                repo-id="R_kgDON4fo0g"
                category="Announcements"
                category-id="DIC_kwDON4fo0s4CzgGJ"
                mapping="pathname"
                strict="1"
                term="请不吝赐教!"
                reactions-enabled="1"
                emit-metadata="0"
                input-position="top"
                lang="zh-CN"
                loading="lazy"
                :theme="isDark ? 'dark_tritanopia' : 'light_tritanopia'"></Giscus>
    </div>
</template>

<script setup>
    import Giscus from '@giscus/vue'
    import { watch } from 'vue'
    import { inBrowser, useData, useRoute } from 'vitepress'

    const { isDark } = useData()
    const route = useRoute()

    watch(isDark, (dark) => {
        if (!inBrowser) return

        const iframe = document.querySelector('giscus-widget')?.shadowRoot?.querySelector('iframe')

        iframe?.contentWindow?.postMessage({ giscus: { setConfig: { theme: dark ? 'dark_tritanopia' : 'light_tritanopia' } } }, 'https://giscus.app')
    })
</script>