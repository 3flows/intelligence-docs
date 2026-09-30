// @ts-check

const sidebars = {
  intelligenceSidebar: [
    {
      type: 'category',
      label: 'Tutorial: A support desk',
      collapsed: false,
      link: { type: 'doc', id: 'tutorial/index' },
      items: [
        {
          type: 'category',
          label: 'Part 1: Your first intelligent service',
          collapsed: false,
          items: [
            'tutorial/setup',
            'tutorial/intelligent-service',
            'tutorial/anatomy-of-a-call',
            'tutorial/prompts-as-configuration',
            'tutorial/swap-and-test'
          ]
        },
        {
          type: 'category',
          label: 'Part 2: Turn language into data',
          collapsed: false,
          items: [
            'tutorial/choose',
            'tutorial/judge',
            'tutorial/extract',
            'tutorial/meaning-and-action'
          ]
        },
        {
          type: 'category',
          label: 'Part 3: Converse and act',
          collapsed: false,
          items: [
            'tutorial/remember',
            'tutorial/stream',
            'tutorial/act'
          ]
        },
        {
          type: 'category',
          label: 'Part 4: Give it knowledge',
          collapsed: false,
          items: [
            'tutorial/documents-as-context',
            'tutorial/embeddings',
            'tutorial/answer-from-knowledge',
            'tutorial/rerank'
          ]
        },
        {
          type: 'category',
          label: 'Part 5: Quality and guardrails',
          collapsed: false,
          items: [
            'tutorial/measure',
            'tutorial/improve-with-evidence',
            'tutorial/judge-the-answers',
            'tutorial/guard-the-input',
            'tutorial/guard-the-output',
            'tutorial/humans-in-the-loop'
          ]
        },
        {
          type: 'category',
          label: 'Part 6: Run it in production',
          collapsed: false,
          items: [
            'tutorial/the-right-model-for-each-job',
            'tutorial/dont-block',
            'tutorial/see-what-it-did',
            'tutorial/going-live'
          ]
        },
        'tutorial/whats-next'
      ]
    },
    'why',
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
        'concepts/conversations',
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
        'api/conversations',
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
