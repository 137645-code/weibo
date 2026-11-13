<template>
  <header class="page-header">
    <!-- 手绘感 sparkle 图标：纯内联 SVG + 渐变，无外部资源 -->
    <span class="brand-icon" aria-hidden="true">
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient
            id="sparkGrad"
            x1="8"
            y1="4"
            x2="56"
            y2="56"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stop-color="#8FBEF0"></stop>
            <stop offset=".55" stop-color="#4E86D8"></stop>
            <stop offset="1" stop-color="#E3A9C2"></stop>
          </linearGradient>
        </defs>
        <path
          d="M30 6c2.2 15.6 7.4 20.8 23 23-15.6 2.2-20.8 7.4-23 23-2.2-15.6-7.4-20.8-23-23 15.6-2.2 20.8-7.4 23-23z"
          fill="url(#sparkGrad)"
        ></path>
        <path
          d="M53 6c1 6.4 3.6 9 10 10-6.4 1-9 3.6-10 10-1-6.4-3.6-9-10-10 6.4-1 9-3.6 10-10z"
          fill="#A9CBF3"
        ></path>
      </svg>
    </span>
    <h1 class="page-title">Spark</h1>
    <p class="page-name-cn">星火</p>
    <p class="page-subtitle">把此刻的想法留在这里，内容仅保存在本机浏览器</p>
  </header>
</template>
