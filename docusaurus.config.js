// @ts-check

const config = {
  title: '3flows Intelligence',
  tagline: 'AI features your team can read, review and own.',
  favicon: 'img/3flows-mark-3f.png',

  url: 'https://3flows.github.io',
  baseUrl: '/intelligence-docs/',
  organizationName: '3flows',
  projectName: 'intelligence-docs',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn'
    }
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          routeBasePath: 'docs',
          editUrl: 'https://github.com/3flows/intelligence-docs/tree/main/'
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css')
        }
      }
    ]
  ],

  themeConfig: {
    image: 'img/3flows-wordmark-blue.png',
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true
    },
    navbar: {
      title: 'Intelligence',
      logo: {
        alt: '3flows',
        src: 'img/3flows-wordmark-blue.png',
        srcDark: 'img/3flows-wordmark-white.png'
      },
      items: [
        { to: '/docs/tutorial', label: 'Tutorial', position: 'left' },
        { to: '/docs/why', label: 'Why', position: 'left' },
        { to: '/docs/concepts/models-for-developers', label: 'Concepts', position: 'left' },
        { to: '/docs/api/overview', label: 'Fluent API', position: 'left' },
        { type: 'docSidebar', sidebarId: 'intelligenceSidebar', position: 'left', label: 'Docs' },
        { href: 'https://3flows.github.io/platform-docs/', label: 'Platform', position: 'right' },
        { href: 'https://github.com/3flows/intelligence-samples', label: 'Samples', position: 'right' },
        { href: 'https://github.com/3flows/intelligence', label: 'GitHub', position: 'right' }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Tutorial', to: '/docs/tutorial' },
            { label: 'Why 3flows Intelligence', to: '/docs/why' },
            { label: 'Concepts', to: '/docs/concepts/models-for-developers' },
            { label: 'Fluent API', to: '/docs/api/overview' },
            { label: 'Configuration', to: '/docs/configuration/overview' }
          ]
        },
        {
          title: 'Community',
          items: [
            { label: 'Samples', href: 'https://github.com/3flows/intelligence-samples' },
            { label: 'GitHub', href: 'https://github.com/3flows/intelligence' },
            { label: '3flows Platform', href: 'https://3flows.github.io/platform-docs/' }
          ]
        }
      ],
      copyright: `© ${new Date().getFullYear()} 3flows GmbH · We build bridges.`
    },
    prism: {
      theme: require('prism-react-renderer').themes.github,
      darkTheme: require('prism-react-renderer').themes.oceanicNext,
      additionalLanguages: ['bash', 'typescript', 'yaml', 'json']
    }
  }
};

module.exports = config;
