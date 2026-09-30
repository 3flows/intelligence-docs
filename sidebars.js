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
          label: 'Part 1: Ask the model',
          collapsed: false,
          items: [
            'tutorial/setup',
            'tutorial/hello-model',
            'tutorial/give-it-a-job',
            'tutorial/prompts-in-yaml',
            'tutorial/test-without-a-model'
          ]
        },
        {
          type: 'category',
          label: 'Part 2: Turn language into data',
          collapsed: false,
          items: [
            'tutorial/route-tickets',
            'tutorial/tag-topics',
            'tutorial/flag-urgent-tickets',
            'tutorial/measure-frustration',
            'tutorial/extract-a-triage-record',
            'tutorial/triage-in-the-background'
          ]
        },
        {
          type: 'category',
          label: 'Part 3: Talk and act',
          collapsed: false,
          items: [
            'tutorial/remember-the-conversation',
            'tutorial/stream-the-answer',
            'tutorial/let-it-look-things-up',
            'tutorial/read-attachments'
          ]
        },
        {
          type: 'category',
          label: 'Part 4: Answer from knowledge',
          collapsed: false,
          items: [
            'tutorial/embeddings',
            'tutorial/answer-from-the-help-center',
            'tutorial/rerank'
          ]
        },
        {
          type: 'category',
          label: 'Part 5: Operate it',
          collapsed: false,
          items: [
            'tutorial/the-right-model-for-each-job',
            'tutorial/guardrails',
            'tutorial/see-what-the-model-did'
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
