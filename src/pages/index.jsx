import clsx from 'clsx';
import Heading from '@theme/Heading';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import Link from '@docusaurus/Link';
import styles from './index.module.css';

const serviceCode = `@Register()
export class SupportService extends IntelligenceService {
    handlers = () => [
        handler('triageTicket', Ticket, Triage, async (ticket, trigger) => {
            const decision = await trigger.context
                .inference()
                .choice('department')
                .state('Route this support ticket.')
                .oneOf(['billing', 'shipping', 'technical'])
                .with(ticket.text)
                .metadata({ purpose: 'triage', subjectType: 'ticket', subjectId: ticket.id })
                .timeout(10_000)
                .decide();

            await trigger.ok({ department: decision.value });
        })
    ];
}`;

const yamlCode = `ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
    connection:
      apiKey: \${{ OPENAI_API_KEY }}
    defaults:
      timeoutMs: 10000

chatbots:
  - name: support
    type: conversation
    model: DEFAULT
    http:
      path: /support`;

const points = [
  {
    title: 'AIs configure capability providers',
    description:
      'YAML says which provider/model supplies chat, structured output, tools, embeddings and other capabilities.'
  },
  {
    title: 'Inference is the service API',
    description:
      'Handlers call chat, choice, check, score, extract and more through one Fluent API with metadata, timeouts and tests.'
  },
  {
    title: 'Chatbots, agents and workflows build up',
    description:
      'Add a chatbot for human sessions, agents for task runs, and workflows for known multi-step business processes.'
  }
];

const journey = [
  { step: '1', label: 'Configure AIs', to: '/docs/learning-path/ais' },
  { step: '2', label: 'Use Fluent inference', to: '/docs/learning-path/inference' },
  { step: '3', label: 'Add a chatbot', to: '/docs/learning-path/chatbots' },
  { step: '4', label: 'Add skills and agents', to: '/docs/learning-path/agents-and-skills' },
  { step: '5', label: 'Orchestrate with workflows', to: '/docs/learning-path/workflows' }
];

function Hero() {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          Build AI applications on Platform primitives.
        </Heading>
        <p className="hero__subtitle">
          Configure AIs, call capabilities through Fluent inference, then add chatbots, agents, skills and workflows as your app grows.
        </p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs/learning-path">
            Start the learning path
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
    <Layout title="3flows Intelligence" description="Build AI applications on Platform primitives.">
      <Hero />
      <main>
        <section className={styles.section}>
          <div className="container">
            <Heading as="h2" className={styles.center}>A small, complete Intelligence feature</Heading>
            <p className={styles.center}>
              Code asks for a capability. Configuration decides which AI provides it. Platform services own the business behavior.
            </p>
            <div className="row">
              <div className="col col--7">
                <CodeBlock language="ts" title="support-service.ts">{serviceCode}</CodeBlock>
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
            <Heading as="h2" className={styles.center}>Learn the building blocks in order</Heading>
            <p className={styles.center}>
              The starter sample follows this exact path, so each concept has a concrete file to inspect.
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
              <Link className="button button--primary button--lg" to="/docs/learning-path">
                Start the learning path
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
