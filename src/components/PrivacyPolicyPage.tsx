import { Link } from 'react-router-dom';

const sections = [
  {
    title: '1. About EducationRev',
    body: [
      'EducationRev is an AI-powered learning platform designed for high school and university level students. It helps students organise their studies through features including study planners, assignments, flashcards, quizzes, AI tutoring, study notes, class management, and collaborative learning tools.',
      'To support seamless distance collaboration and document workflow, the app includes integrated Jitsi meeting features and Microsoft Word integration tools.',
    ],
  },
  {
    title: '2. Information We Collect',
    body: [
      'Depending on how you use the app, we may collect account information such as name, email address, institution name, grade or study level, optional profile picture, authentication provider, and temporary guest session details.',
      'We may also collect user and academic content including notes, flashcards, assignments, task sheets, study rubrics, planner events, study materials, collaborative messages, uploaded files, AI prompts, and conversations.',
      'Device and usage information may include device type, operating system, app version, crash reports, diagnostics, and anonymous analytics about how features are used.',
    ],
  },
  {
    title: '3. How We Use Your Information',
    body: [
      'We use your information to create and manage secure accounts, provide AI-powered learning and assessment helper features, analyse uploaded assignments and notes, synchronise studies across devices, save study progress, optimise performance, fix bugs, respond to support requests, protect against fraud and abuse, and comply with legal obligations.',
    ],
  },
  {
    title: '4. Collaborative Features & User Responsibility',
    body: [
      'EducationRev provides integrated group chats and Jitsi meeting facilities to support peer-to-peer study groups.',
      'Users are responsible for ensuring that any group chats or virtual meetings they create or join are established strictly with fellow students. The application is not intended to be used as a general public social platform.',
    ],
  },
  {
    title: '5. Artificial Intelligence & Document Processing',
    body: [
      'EducationRev includes AI-powered features that generate study materials and educational content based on prompts and uploaded files.',
      'Assignments, study notes, and task sheets uploaded by users may be parsed and analysed to generate custom breakdowns, flashcards, mind maps, and revision materials. AI-generated responses are provided for educational support purposes only.',
    ],
  },
  {
    title: '6. Third-Party Services',
    body: [
      'EducationRev may use trusted third-party services including Firebase Authentication, Firebase Firestore, Firebase Storage, Google Cloud Platform, Google Sign-In, Jitsi Meet API, Microsoft Word Integration API, AI service providers, analytics, and crash reporting tools.',
    ],
  },
  {
    title: '7. Data Storage & Security',
    body: [
      'Your information is stored using industry-standard cloud infrastructure and reasonable technical, administrative, and organisational safeguards. No method of electronic storage or internet transmission is completely secure, and absolute security cannot be guaranteed.',
    ],
  },
  {
    title: '8. Data Sharing',
    body: [
      'We do not sell, lease, or trade personal information. Information may be shared only with trusted service providers necessary to operate the app, where required by law or court process, to protect user safety or security, or during a business transfer such as a merger or acquisition.',
    ],
  },
  {
    title: '9. Your Rights & Privacy Complaints',
    body: [
      'You may request access to, correction of, or deletion of personal information associated with your account. You may also submit privacy complaints to our support email. We will investigate and respond within 30 days.',
    ],
  },
  {
    title: "10. Children's Privacy & Parental Supervision",
    body: [
      'EducationRev is primarily designed for high school and university level students. Middle school students may also use the application with direct parental guidance, supervision, and prior approval.',
      'If we become aware that personal information has been collected from a student under 13 without appropriate parental guidance and consent, we will take reasonable steps to remove or secure that information.',
    ],
  },
  {
    title: '11. Account Deletion',
    body: [
      'You may request deletion of your account and associated personal information by contacting our support team. Some information may be retained where required by law or for legitimate security purposes.',
    ],
  },
  {
    title: '12. Changes to This Policy',
    body: [
      'We may update this Privacy Policy from time to time. Material changes will be posted within the application or on our website together with an updated effective date.',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 font-sans text-slate-950">
      <article className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-10">
        <Link to="/landing" className="text-sm font-black text-indigo-600">
          EducationRev
        </Link>
        <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">EducationRev Privacy Policy</h1>
        <p className="mt-4 text-base font-bold text-slate-500">Effective Date: July 14, 2026</p>
        <p className="mt-6 text-lg font-semibold leading-8 text-slate-600">
          Thank you for using EducationRev. Your privacy is important to us. This Privacy Policy outlines how we manage, protect, and respect your personal information and data privacy across our learning platforms.
        </p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-black tracking-tight">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-base font-medium leading-7 text-slate-600">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-xl font-black tracking-tight">13. Contact Information</h2>
          <p className="mt-3 text-base font-medium leading-7 text-slate-600">
            If you have questions regarding this Privacy Policy or your personal information, please contact EducationRev Support.
          </p>
          <p className="mt-3 text-base font-bold text-slate-700">
            Email: <a className="text-indigo-600" href="mailto:nemeanpartnersptyltd@gmail.com?subject=EducationRev%20Privacy">nemeanpartnersptyltd@gmail.com</a>
          </p>
        </section>
      </article>
    </main>
  );
}
