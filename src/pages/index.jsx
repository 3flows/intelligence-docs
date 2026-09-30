import clsx from 'clsx';
import Heading from '@theme/Heading';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import Link from '@docusaurus/Link';
import styles from './index.module.css';

const serviceCode = `@Register()
export class TicketsService extends IntelligenceService {
    handlers = () => [
        handler('triage', Ticket, Triage, async (ticket, trigger) => {
            const ai = trigger.context.inference();

            const department = await ai.choice('department')
                .oneOf(['billing', 'technical', 'sales'])
                .with(ticket.body)
                .ask('Which team should handle this ticket?');

            const urgent = await ai.check('urgent')
                .with(ticket.body)
                .ask('Does this need an answer today?');

            await trigger.ok({
                department: department.value,
                urgent: urgent.value
            });
        })
    ];
}`;

const yamlCode = `services:
  - name: TicketsService

https:
  - name: api
    port: 3000
    services:
      - name: TicketsService

ais:
  - name: DEFAULT
    provider: openai      # anthropic, azureai,
    model: gpt-4.1-mini   # groq, ollama, lmstudio, ...
    connection:
      apiKey: \${{ OPENAI_API_KEY }}`;

const points = [
  {
    title: 'Capabilities, not vendors',
    description:
      'Code asks for what it needs: chat, a choice, a score, an embedding. YAML decides which model and which provider delivers it.'
  },
  {
    title: 'Language in, data out',
    description:
      'choice, check, score and extract turn free text into typed values that a service can store, route and test.'
  },
  {
    title: 'Reviewable by design',
    description:
      'One small vocabulary for prompts, context, tools and conversations. A reviewer sees what the model gets, what it may do, and what comes back.'
  }
];

const journey = [
  { step: '·', label: 'Set up', to: '/docs/tutorial/setup' },
  { step: '1', label: 'Intelligent service', to: '/docs/tutorial/intelligent-service' },
  { step: '3', label: 'Prompts', to: '/docs/tutorial/prompts-as-configuration' },
  { step: '4', label: 'Swap & test', to: '/docs/tutorial/swap-and-test' },
  { step: '5', label: 'Choose', to: '/docs/tutorial/choose' },
  { step: '7', label: 'Extract', to: '/docs/tutorial/extract' },
  { step: '9', label: 'Conversations', to: '/docs/tutorial/remember' },
  { step: '11', label: 'Tools', to: '/docs/tutorial/act' },
  { step: '14', label: 'RAG', to: '/docs/tutorial/answer-from-knowledge' },
  { step: '16', label: 'Evaluate', to: '/docs/tutorial/measure' },
  { step: '18', label: 'Judges', to: '/docs/tutorial/judge-the-answers' },
  { step: '19', label: 'Guardrails', to: '/docs/tutorial/guard-the-input' },
  { step: '22', label: 'Many models', to: '/docs/tutorial/the-right-model-for-each-job' },
  { step: '24', label: 'Observability', to: '/docs/tutorial/see-what-it-did' }
];

function Hero() {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          AI features your team can read, review and own.
        </Heading>
        <p className="hero__subtitle">
          Ask for a capability in one fluent line. Decide in YAML which model answers.
        </p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs/tutorial">
            Start the tutorial
          </Link>
          <Link className="button button--outline button--secondary button--lg" to="/docs/why">
            Why 3flows Intelligence
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  return (
    <Layout title="3flows Intelligence" description="AI features your team can read, review and own.">
      <Hero />
      <main>
        <section className={styles.section}>
          <div className="container">
            <Heading as="h2" className={styles.center}>This is a complete AI feature</Heading>
            <p className={styles.center}>
              Route a support ticket and flag it as urgent, with no SDK, no JSON parsing and no provider in sight.
            </p>
            <div className="row">
              <div className="col col--7">
                <CodeBlock language="ts" title="tickets.ts">{serviceCode}</CodeBlock>
              </div>
              <div className="col col--5">
                <CodeBlock language="yaml" title="intelligence.yml">{yamlCode}</CodeBlock>
              </div>
            </div>
          </div>
        </section>

        <section className={clsx(styles.section, styles.alt)}>
          <div className="container">
            <div className="row">
              {points.map(({ title, description }) => (
                <div key={title} className="col col--4">
                  <Heading as="h3">{title}</Heading>
                  <p>{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className="container">
            <Heading as="h2" className={styles.center}>From a first question to an assistant you can measure, guard and operate</Heading>
            <p className={styles.center}>
              One small support desk in six parts, one new concept per chapter. Built on the 3flows Platform, so storage, queues and HTTP are already solved.
            </p>
            <div className={styles.journey}>
              {journey.map(({ step, label, to }) => (
                <Link key={step} to={to} className={styles.journeyItem}>
                  <span className={styles.journeyStep}>{step}</span>
                  <span>{label}</span>
                </Link>
              ))}
            </div>
            <div className={styles.buttons}>
              <Link className="button button--primary button--lg" to="/docs/tutorial">
                Start the tutorial
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
