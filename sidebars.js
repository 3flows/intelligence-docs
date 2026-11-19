// @ts-check

const sidebars = {
  intelligenceSidebar: [
    {
      type: 'category',
      label: 'Start here: 0.9 building blocks',
      collapsed: false,
      link: { type: 'doc', id: 'learning-path/index' },
      items: [
        'learning-path/ais',
        'learning-path/inference',
        'learning-path/chatbots',
        'learning-path/agents-and-skills',
        'learning-path/workflows'
      ]
    },
    'why',
    {
      type: 'category',
      label: 'Release 0.9',
      collapsed: false,
      items: [
        'whats-new-0.9',
        'migration-0.8-to-0.9'
      ]
    },
    {
      type: 'category',
      label: 'Core Concepts',
      collapsed: true,
      items: [
        'concepts/models-for-developers',
        'concepts/capabilities-and-providers',
        'concepts/the-fluent-api',
        'concepts/context-and-prompts',
        'concepts/language-into-data',
        'concepts/chatbots',
        'concepts/agents',
        'concepts/skills',
        'concepts/workflows',
        'concepts/tools',
        'concepts/retrieval',
        'concepts/modalities',
        'concepts/responsibility'
      ]
    },
    {
      type: 'category',
      label: 'Fluent API',
      collapsed: true,
      items: [
        'api/overview',
        'api/chat',
        'api/decisions',
        'api/extract',
        'api/tools',
        'api/inputs-and-files',
        'api/embeddings-and-reranking',
        'api/audio-and-media',
        'api/moderation',
        'api/results-and-streams'
      ]
    },
    {
      type: 'category',
      label: 'Guides',
      collapsed: true,
      items: [
        'guides/testing',
        'guides/local-models',
        'guides/writing-prompts',
        'guides/observability',
        'guides/custom-provider',
        'guides/known-gaps'
      ]
    },
    {
      type: 'category',
      label: 'Configuration Reference',
      collapsed: true,
      items: [
        'configuration/overview',
        'configuration/ais',
        'configuration/prompts',
        'configuration/conversations',
        'configuration/tracers'
      ]
    }
  ]
};

module.exports = sidebars;
