<script setup lang="ts">
    import { useRouter, useData } from 'vitepress'
    import DefaultTheme from 'vitepress/theme'
    import GiscusComment from './GiscusComment.vue'
    import { onMounted } from 'vue'

    // const { site } = useData()
    // const router = useRouter()

    // onMounted(() => {
    //     const lang = navigator.language.split('-')[0]
    //     const supportedLangs = ['zh', 'en', 'ru', 'id', 'jp']
    //     const targetLang = supportedLangs.includes(lang) ? lang : 'zh'

    //     // 避免无限循环
    //     const path = window.location.pathname
    //     const base = site.value.base
    //     if (path === base || path === base + 'index' || path === base + 'index.html' || path === base.slice(0, -1)) {
    //         router.go(`${base}${targetLang}/`)
    //     }
    // })
</script>

<template>
    <DefaultTheme.Layout>
        <template #doc-after>
            <GiscusComment />
        </template>
    </DefaultTheme.Layout>
</template>

