import { useEffect, useRef, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    // Scroll Observer for watch class elements
    const watchEls = Array.from(root.querySelectorAll('.watch'));
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const target = e.target;
            setTimeout(() => {
              target.classList.add('show');
              target.classList.add('in');
            }, Math.max(0, watchEls.indexOf(target) % 8) * 70);
          }
        });
      },
      { threshold: 0.18 }
    );
    watchEls.forEach((el) => obs.observe(el));

    // Cards Flipped / Show animation logic with continuous back-and-forth flipping loop
    const cardsStage = root.querySelector('#cardsStage');
    let cardTimer: ReturnType<typeof setTimeout> | null = null;
    let cardsInterval: ReturnType<typeof setInterval> | null = null;

    if (cardsStage) {
      const cardObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              cardsStage.classList.remove('cards-flipped');
              cardsStage.classList.add('cards-show');
              if (cardTimer) clearTimeout(cardTimer);
              if (cardsInterval) clearInterval(cardsInterval);
              cardTimer = setTimeout(() => {
                cardsStage.classList.add('cards-flipped');
                // Continuously flip back and forth to keep them animated more dynamically!
                cardsInterval = setInterval(() => {
                  cardsStage.classList.toggle('cards-flipped');
                }, 3000);
              }, 1200);
            }
          });
        },
        { threshold: 0.45 }
      );
      cardObs.observe(cardsStage);
    }

    // Smooth Scrolling for anchor links inside container
    const handleAnchorClick = (e: MouseEvent) => {
      const targetEl = e.currentTarget as HTMLAnchorElement;
      const href = targetEl.getAttribute('href');
      if (href && href.startsWith('#')) {
        const id = href;
        const target = root.querySelector(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    const anchors = root.querySelectorAll('a[href^="#"]');
    anchors.forEach((a) => a.addEventListener('click', handleAnchorClick as EventListener));

    return () => {
      obs.disconnect();
      anchors.forEach((a) => a.removeEventListener('click', handleAnchorClick as EventListener));
      if (cardTimer) clearTimeout(cardTimer);
      if (cardsInterval) clearInterval(cardsInterval);
    };
  }, []);

  return (
    <div id="edurev-embed" ref={containerRef} className="min-h-screen bg-[#05060a]">
      <style>{`
        #edurev-embed {
          --ink: #eef1ff;
          --muted: #9aa1c3;
          --accent: #7cf6ff;
          --accent2: #9b8cff;
          --accent3: #ffb84d;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          background: radial-gradient(900px 520px at 80% 0%, rgba(155, 140, 255, .22), transparent 60%), radial-gradient(760px 460px at 0% 22%, rgba(124, 246, 255, .16), transparent 58%), #05060a;
          color: var(--ink);
          overflow: hidden;
          width: 100%;
        }
        #edurev-embed * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        #edurev-embed a {
          text-decoration: none;
          color: inherit;
        }

        #edurev-embed .nav {
          position: relative;
          z-index: 20;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 22px;
          background: rgba(5, 6, 10, .55);
          border-bottom: 1px solid rgba(255, 255, 255, .08);
          backdrop-filter: blur(14px);
        }

        #edurev-embed .brand {
          display: flex;
          align-items: center;
          gap: 18px;
          color: #fff;
        }

        #edurev-embed .brand-logo {
          width: 64px;
          height: 64px;
          object-fit: contain;
          filter: drop-shadow(0 0 18px rgba(124, 246, 255, .35)) drop-shadow(0 0 28px rgba(255, 140, 40, .18));
          flex-shrink: 0;
        }

        #edurev-embed .brand-text {
          display: flex;
          flex-direction: column;
          line-height: 1;
        }

        #edurev-embed .brand-title {
          font-size: clamp(32px, 5vw, 48px);
          font-weight: 900;
          letter-spacing: -0.06em;
          color: #fff;
        }

        #edurev-embed .brand-sub {
          margin-top: 10px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--muted);
        }

        #edurev-embed .links {
          display: flex;
          gap: 20px;
          font-size: 13px;
          color: var(--muted);
        }
        #edurev-embed .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 11px 18px;
          border-radius: 999px;
          border: 0;
          cursor: pointer;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          color: #071018;
          font-weight: 900;
          font-size: 13px;
          box-shadow: 0 12px 34px rgba(124, 246, 255, .22);
          transition: all 0.2s ease;
        }
        #edurev-embed .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 38px rgba(124, 246, 255, .3);
        }
        #edurev-embed .ghost {
          background: rgba(255, 255, 255, .06);
          border: 1px solid rgba(255, 255, 255, .14);
          color: var(--ink);
        }

        #edurev-embed .scene {
          position: relative;
          min-height: 720px;
          padding: 72px 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        #edurev-embed #hero {
          min-height: 650px;
          padding-top: 48px;
        }
        #edurev-embed .stage {
          width: 100%;
          max-width: 1120px;
          margin: 0 auto;
          position: relative;
          z-index: 2;
        }
        #edurev-embed .center {
          text-align: center;
          max-width: 850px;
          margin: 0 auto;
        }

        #edurev-embed .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--muted);
          font-size: 12px;
          letter-spacing: .16em;
          text-transform: uppercase;
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, .14);
          background: rgba(255, 255, 255, .055);
        }
        #edurev-embed .ping {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 12px var(--accent);
        }
        #edurev-embed h1, #edurev-embed h2 {
          margin: 18px 0 0;
          font-weight: 900;
          letter-spacing: -.045em;
          line-height: 1.04;
        }
        #edurev-embed h1 {
          font-size: clamp(42px, 8vw, 92px);
          background: linear-gradient(180deg, #fff, #aab1d6);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        #edurev-embed h2 {
          font-size: clamp(32px, 5vw, 62px);
        }
        #edurev-embed p {
          color: var(--muted);
          line-height: 1.65;
          font-size: 16px;
        }
        #edurev-embed .lead {
          max-width: 620px;
          margin: 22px auto 0;
        }
        #edurev-embed .actions {
          display: flex;
          gap: 14px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 30px;
        }
        #edurev-embed .chips {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 22px;
        }
        #edurev-embed .chips span {
          background: rgba(10, 15, 30, 0.88);
          border: 1.5px solid rgba(124, 246, 255, 0.45);
          color: #ffffff;
          border-radius: 999px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: .02em;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(16px);
        }

        #edurev-embed .beam-line {
          position: absolute;
          left: 50%;
          top: 8%;
          bottom: 8%;
          width: 2px;
          background: linear-gradient(180deg, transparent, var(--accent), var(--accent2), transparent);
          box-shadow: 0 0 30px var(--accent), 0 0 80px var(--accent2);
          transform: scaleY(.15);
          opacity: .3;
          transition: 1s ease;
        }
        #edurev-embed .in .beam-line {
          transform: scaleY(1);
          opacity: 1;
        }

        #edurev-embed .split {
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          gap: 44px;
          align-items: center;
        }
        #edurev-embed .folder-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }
        #edurev-embed .folder {
          min-height: 150px;
          border-radius: 20px;
          padding: 18px;
          color: #071018;
          font-weight: 900;
          background: linear-gradient(145deg, var(--c1), var(--c2));
          box-shadow: 0 30px 70px rgba(0, 0, 0, .38);
          transform: translateY(35px) rotateX(10deg);
          opacity: 0;
          transition: .75s cubic-bezier(.2, .7, .2, 1);
        }
        #edurev-embed .folder.show {
          transform: translateY(0) rotateX(0);
          opacity: 1;
        }
        #edurev-embed .small {
          font-size: 11px;
          letter-spacing: .13em;
          text-transform: uppercase;
          opacity: .72;
          margin-bottom: 8px;
        }
        #edurev-embed .name {
          font-size: 22px;
        }

        #edurev-embed .cards-stage {
          height: 430px;
          position: relative;
          margin-top: 42px;
          perspective: 1300px;
          transform-style: preserve-3d;
        }
        #edurev-embed .flashcard {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 220px;
          height: 280px;
          margin: -140px 0 0 -110px;
          transform-style: preserve-3d;
          will-change: transform;
          transition: transform 1.05s cubic-bezier(.2, .7, .2, 1);
        }
        #edurev-embed .face {
          position: absolute;
          inset: 0;
          border-radius: 22px;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
          box-shadow: 0 30px 70px rgba(0, 0, 0, .5), inset 0 0 0 1px rgba(255, 255, 255, .12);
        }
        #edurev-embed .front {
          background: linear-gradient(160deg, #13182b, #20274a);
          color: #eef1ff;
          font-size: 18px;
          font-weight: 800;
        }
        #edurev-embed .back {
          background: linear-gradient(160deg, var(--accent), var(--accent2));
          color: #071018;
          font-size: 16px;
          font-weight: 900;
          transform: rotateY(180deg);
        }

        #edurev-embed .cards-stage.cards-show .flashcard:nth-child(1) {
          transform: translate3d(-170px, -25px, 40px) rotateZ(-22deg) rotateY(0deg);
        }
        #edurev-embed .cards-stage.cards-show .flashcard:nth-child(2) {
          transform: translate3d(-85px, -35px, 40px) rotateZ(-11deg) rotateY(0deg);
        }
        #edurev-embed .cards-stage.cards-show .flashcard:nth-child(3) {
          transform: translate3d(0, -42px, 40px) rotateZ(0deg) rotateY(0deg);
        }
        #edurev-embed .cards-stage.cards-show .flashcard:nth-child(4) {
          transform: translate3d(85px, -35px, 40px) rotateZ(11deg) rotateY(0deg);
        }
        #edurev-embed .cards-stage.cards-show .flashcard:nth-child(5) {
          transform: translate3d(170px, -25px, 40px) rotateZ(22deg) rotateY(0deg);
        }

        #edurev-embed .cards-stage.cards-flipped .flashcard:nth-child(1) {
          transform: translate3d(-220px, -30px, 40px) rotateZ(-22deg) rotateY(180deg);
        }
        #edurev-embed .cards-stage.cards-flipped .flashcard:nth-child(2) {
          transform: translate3d(-110px, -38px, 40px) rotateZ(-11deg) rotateY(180deg);
        }
        #edurev-embed .cards-stage.cards-flipped .flashcard:nth-child(3) {
          transform: translate3d(0, -44px, 40px) rotateZ(0deg) rotateY(180deg);
        }
        #edurev-embed .cards-stage.cards-flipped .flashcard:nth-child(4) {
          transform: translate3d(110px, -38px, 40px) rotateZ(11deg) rotateY(180deg);
        }
        #edurev-embed .cards-stage.cards-flipped .flashcard:nth-child(5) {
          transform: translate3d(220px, -30px, 40px) rotateZ(22deg) rotateY(180deg);
        }

        #edurev-embed .mind-wrap {
          position: relative;
          width: min(900px, 95vw);
          height: 520px;
          margin: 30px auto 0;
        }
        #edurev-embed .mind-wrap svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        #edurev-embed .edge {
          stroke: url(#edgeGrad);
          stroke-width: 1.7;
          fill: none;
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          transition: stroke-dashoffset 1.15s ease;
          filter: drop-shadow(0 0 6px rgba(124, 246, 255, .45));
        }
        #edurev-embed .edge.show {
          stroke-dashoffset: 0;
        }
        #edurev-embed .node {
          position: absolute;
          transform: translate(-50%, -50%) scale(.2);
          opacity: 0;
          padding: 10px 16px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, .16);
          background: rgba(255, 255, 255, .07);
          backdrop-filter: blur(10px);
          font-size: 13px;
          white-space: nowrap;
          transition: transform .7s cubic-bezier(.2, .7, .2, 1), opacity .7s ease, box-shadow .7s ease;
        }
        #edurev-embed .node.show {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
          box-shadow: 0 0 28px rgba(124, 246, 255, .22);
        }
        #edurev-embed .node.main {
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          color: #071018;
          font-weight: 900;
          border: 0;
          box-shadow: 0 0 42px rgba(124, 246, 255, .45);
        }

        #edurev-embed .dash {
          margin-top: 40px;
          border-radius: 26px;
          border: 1px solid rgba(255, 255, 255, .14);
          background: linear-gradient(160deg, rgba(20, 24, 42, .9), rgba(10, 12, 22, .9));
          box-shadow: 0 50px 110px rgba(0, 0, 0, .48);
          padding: 28px;
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 18px;
        }
        #edurev-embed .panel {
          background: rgba(255, 255, 255, .055);
          border: 1px solid rgba(255, 255, 255, .12);
          border-radius: 18px;
          padding: 18px;
          opacity: 0;
          transform: translateY(26px);
          transition: .75s ease;
          text-align: left;
        }
        #edurev-embed .panel.show {
          opacity: 1;
          transform: translateY(0);
        }
        #edurev-embed .big {
          font-size: 30px;
          font-weight: 900;
          margin-top: 6px;
        }
        #edurev-embed .bar {
          height: 7px;
          background: rgba(255, 255, 255, .08);
          border-radius: 999px;
          margin-top: 12px;
          overflow: hidden;
        }
        #edurev-embed .bar i {
          display: block;
          height: 100%;
          width: var(--w);
          background: linear-gradient(90deg, var(--accent), var(--accent2));
          border-radius: 999px;
        }
        #edurev-embed #ed-cta {
          min-height: 560px;
          background: radial-gradient(700px 420px at 50% 30%, rgba(155, 140, 255, .25), transparent 65%);
        }
        #edurev-embed footer {
          text-align: center;
          color: var(--muted);
          padding: 40px 20px;
          border-top: 1px solid rgba(255, 255, 255, .1);
          font-size: 13px;
        }

        /* FLY-IN AND LAND ANIMATIONS FOR THE PAPERS ON HERO OPEN */
        @keyframes flyAndLandTopLeft {
          0% {
            transform: translate(-300px, -400px) rotate(90deg);
            opacity: 0;
          }
          100% {
            transform: translate(0, 0) rotate(11deg);
            opacity: 1;
          }
        }

        @keyframes flyAndLandLeft {
          0% {
            transform: translate(-300px, 200px) rotate(-45deg);
            opacity: 0;
          }
          100% {
            transform: translate(0, 0) rotate(-16deg);
            opacity: 1;
          }
        }

        @keyframes flyAndLandRightA {
          0% {
            transform: translate(400px, -200px) rotate(45deg);
            opacity: 0;
          }
          100% {
            transform: translate(0, 0) rotate(-10deg);
            opacity: 1;
          }
        }

        @keyframes flyAndLandRightB {
          0% {
            transform: translate(500px, -150px) rotate(-60deg);
            opacity: 0;
          }
          100% {
            transform: translate(0, 0) rotate(-4deg);
            opacity: 1;
          }
        }

        @keyframes flyAndLandRight {
          0% {
            transform: translate(300px, 400px) rotate(-90deg);
            opacity: 0;
          }
          100% {
            transform: translate(0, 0) rotate(17deg);
            opacity: 1;
          }
        }

        @keyframes floatTopLeft {
          0% { transform: translate(0, 0) rotate(11deg); }
          50% { transform: translate(18px, -45px) rotate(15deg); }
          100% { transform: translate(-12px, -20px) rotate(7deg); }
        }

        @keyframes floatLeft {
          0% { transform: translate(0, 0) rotate(-16deg); }
          50% { transform: translate(-20px, -35px) rotate(-10deg); }
          100% { transform: translate(15px, -15px) rotate(-22deg); }
        }

        @keyframes floatRightA {
          0% { transform: translate(0, 0) rotate(-10deg); }
          50% { transform: translate(28px, -40px) rotate(-5deg); }
          100% { transform: translate(-10px, -20px) rotate(-14deg); }
        }

        @keyframes floatRightB {
          0% { transform: translate(0, 0) rotate(-4deg); }
          50% { transform: translate(22px, -50px) rotate(2deg); }
          100% { transform: translate(-18px, -25px) rotate(-9deg); }
        }

        @keyframes floatRight {
          0% { transform: translate(0, 0) rotate(17deg); }
          50% { transform: translate(20px, -45px) rotate(23deg); }
          100% { transform: translate(-18px, -20px) rotate(12deg); }
        }

        #edurev-embed .hero-papers {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          overflow: hidden;
        }

        #edurev-embed .paper-sheet {
          position: absolute;
          width: 205px;
          height: 255px;
          border-radius: 15px;
          background:
            linear-gradient(rgba(155, 145, 118, .42), rgba(155, 145, 118, .42)) 22px 24px/72% 7px no-repeat,
            linear-gradient(rgba(155, 145, 118, .35), rgba(155, 145, 118, .35)) 22px 46px/61% 7px no-repeat,
            linear-gradient(rgba(155, 145, 118, .30), rgba(155, 145, 118, .30)) 22px 68px/49% 7px no-repeat,
            linear-gradient(rgba(155, 145, 118, .38), rgba(155, 145, 118, .38)) 22px 90px/79% 7px no-repeat,
            linear-gradient(rgba(155, 145, 118, .32), rgba(155, 145, 118, .32)) 22px 112px/66% 7px no-repeat,
            linear-gradient(rgba(155, 145, 118, .28), rgba(155, 145, 118, .28)) 22px 134px/56% 7px no-repeat,
            linear-gradient(180deg, #fff9e9 0%, #eee5cf 58%, #e1d4b8 100%);
          border: 1px solid rgba(255, 255, 255, .72);
          box-shadow: 0 28px 70px rgba(0, 0, 0, .38), inset 0 1px 0 rgba(255, 255, 255, .72);
          opacity: .92;
        }

        /* COMPOSING ANIMATIONS TO RUN LAND ONCE, THEN FLOAT FOREVER */
        #edurev-embed .paper-top-left {
          left: -48px;
          top: -56px;
          animation: flyAndLandTopLeft 1.5s cubic-bezier(0.19, 1, 0.22, 1) forwards, floatTopLeft 7s ease-in-out infinite alternate 1.5s;
        }

        #edurev-embed .paper-left {
          left: -16px;
          top: 48%;
          animation: flyAndLandLeft 1.6s cubic-bezier(0.19, 1, 0.22, 1) forwards, floatLeft 6.5s ease-in-out infinite alternate 1.6s;
        }

        #edurev-embed .paper-right-stack-a {
          right: 220px;
          top: 102px;
          animation: flyAndLandRightA 1.8s cubic-bezier(0.19, 1, 0.22, 1) forwards, floatRightA 8s ease-in-out infinite alternate 1.8s;
        }

        #edurev-embed .paper-right-stack-b {
          right: 104px;
          top: 88px;
          animation: flyAndLandRightB 2.0s cubic-bezier(0.19, 1, 0.22, 1) forwards, floatRightB 7.5s ease-in-out infinite alternate 2.0s;
        }

        #edurev-embed .paper-right {
          right: -62px;
          bottom: 72px;
          animation: flyAndLandRight 2.2s cubic-bezier(0.19, 1, 0.22, 1) forwards, floatRight 7s ease-in-out infinite alternate 2.2s;
        }

        #edurev-embed .paper-xl {
          width: 230px;
          height: 285px;
        }

        #edurev-embed .mini-tile {
          position: absolute;
          width: 68px;
          height: 68px;
          border-radius: 17px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #7cf6ff;
          background: rgba(255, 255, 255, .055);
          border: 1px solid rgba(255, 255, 255, .12);
          box-shadow: 0 24px 60px rgba(0, 0, 0, .35);
          backdrop-filter: blur(12px);
          font-size: 31px;
          font-weight: 900;
          animation: heroFloatSmall 6.5s ease-in-out infinite alternate 1.5s;
        }

        #edurev-embed .tile-left { left: 22%; top: 170px; color: #7cf6ff; transform: rotate(3deg); }
        #edurev-embed .tile-globe { right: 205px; top: 54px; color: #9b8cff; transform: rotate(-14deg); }
        #edurev-embed .tile-grid { left: 47%; bottom: 20px; color: #7cf6ff; transform: rotate(-11deg); }
        #edurev-embed .tile-file { right: 76px; bottom: -12px; color: #7affae; transform: rotate(5deg); }

        #edurev-embed .glass-equation {
          position: absolute;
          right: -5px;
          top: 248px;
          width: 205px;
          height: 66px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Georgia, serif;
          font-style: italic;
          font-size: 24px;
          color: rgba(220, 225, 255, .78);
          background: linear-gradient(90deg, rgba(255, 255, 255, .08), rgba(255, 255, 255, .16), rgba(255, 255, 255, .05));
          border: 1px solid rgba(255, 255, 255, .14);
          box-shadow: 0 20px 54px rgba(0, 0, 0, .32);
          backdrop-filter: blur(16px);
        }

        @keyframes heroFloatSmall {
          to {
            margin-top: -16px;
            transform: translateY(-6px) rotate(7deg);
          }
        }

        #edurev-embed #hero.hero-reference {
          min-height: 760px;
          padding: 88px 24px 70px;
          align-items: center;
          background: radial-gradient(900px 520px at 72% 8%, rgba(155, 140, 255, .16), transparent 62%), radial-gradient(620px 360px at 50% 72%, rgba(124, 246, 255, .08), transparent 70%), #05060a;
          overflow: hidden;
        }

        #edurev-embed #hero .hero-content {
          max-width: 960px;
          z-index: 10;
          background: rgba(5, 6, 10, 0.72);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          padding: 48px 32px;
          border-radius: 32px;
          border: 1.5px solid rgba(124, 246, 255, 0.15);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          margin: 0 auto;
          text-align: center;
        }

        #edurev-embed #hero.hero-reference h1 {
          font-size: clamp(40px, 8vw, 92px);
          line-height: 1.02;
          letter-spacing: -.05em;
          margin-top: 24px;
          color: #f3f4f6 !important;
          background: none !important;
          -webkit-background-clip: initial !important;
          background-clip: initial !important;
          -webkit-text-fill-color: #f3f4f6 !important;
          text-shadow: 0 4px 20px rgba(0, 0, 0, 0.95), 0 2px 4px rgba(0, 0, 0, 0.8);
        }

        #edurev-embed #hero.hero-reference .lead {
          max-width: 720px;
          font-size: 18px;
          line-height: 1.72;
          margin: 28px auto 0;
        }

        #edurev-embed #hero.hero-reference .eyebrow {
          background: rgba(255, 255, 255, .055);
          border: 1px solid rgba(255, 255, 255, .18);
          box-shadow: 0 0 22px rgba(124, 246, 255, .08), inset 0 1px 0 rgba(255, 255, 255, .08);
        }

        #edurev-embed #hero.hero-reference .chips {
          margin-top: 44px;
          gap: 14px;
        }

        #edurev-embed #hero.hero-reference .chips span {
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0;
          color: #ffffff;
          background: rgba(10, 15, 30, 0.88);
          border: 1.5px solid rgba(124, 246, 255, 0.45);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(16px);
        }

        #edurev-embed .store-badge {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: #000000;
          border: 1px solid rgba(255, 255, 255, .2);
          border-radius: 12px;
          padding: 8px 16px;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        }
        #edurev-embed .store-badge:hover {
          transform: translateY(-2px);
          border-color: var(--accent);
          box-shadow: 0 12px 35px rgba(124, 246, 255, 0.15);
        }
        #edurev-embed .store-badge-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          line-height: 1.2;
        }
        #edurev-embed .store-badge-text .small-txt {
          font-size: 8px;
          font-weight: 500;
          color: #a0a5c0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        #edurev-embed .store-badge-text .big-txt {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
        }
        #edurev-embed .store-badge-note {
          font-size: 12px;
          color: var(--muted);
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        #edurev-embed .mobile-scroll-hint .arrow {
          color: var(--accent);
          animation: edurevBounce 1.2s infinite;
        }

        @keyframes edurevBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }

        /* RESPONSIVE MEDIA QUERIES FOR APP MARKETS */
        @media(max-width: 760px) {
          #edurev-embed {
            border-radius: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            padding-bottom: 90px !important;
          }

          #edurev-embed .nav {
            position: sticky !important;
            top: 0 !important;
            padding: 8px 12px !important;
            min-height: 50px !important;
            z-index: 999 !important;
          }

          #edurev-embed .links { display: none !important; }

          #edurev-embed .brand { gap: 7px !important; }
          #edurev-embed .brand-logo { width: 36px !important; height: 36px !important; }
          #edurev-embed .brand-title { font-size: 18px !important; }
          #edurev-embed .brand-sub { font-size: 9px !important; margin-top: 2px !important; }

          #edurev-embed .btn {
            padding: 8px 12px !important;
            font-size: 11px !important;
            max-width: 120px !important;
            line-height: 1.1 !important;
            text-align: center !important;
          }

          #edurev-embed .scene {
            min-height: auto !important;
            height: auto !important;
            display: block !important;
            padding: 48px 14px 72px !important;
            overflow: visible !important;
            clear: both !important;
          }

          #edurev-embed .stage,
          #edurev-embed .center {
            width: 100 !important;
            max-width: 100% !important;
          }

          #edurev-embed h1 {
            font-size: 36px !important;
            line-height: .98 !important;
          }

          #edurev-embed h2 {
            font-size: 28px !important;
            line-height: 1.02 !important;
          }

          #edurev-embed .lead,
          #edurev-embed p {
            font-size: 13px !important;
            line-height: 1.5 !important;
          }

          #edurev-embed .eyebrow {
            font-size: 8px !important;
            padding: 6px 10px !important;
          }

          #edurev-embed #hero {
            padding-top: 34px !important;
            padding-bottom: 76px !important;
          }

          #edurev-embed #hero .hero-content {
            padding: 24px 16px !important;
            border-radius: 20px !important;
            margin: 0 8px !important;
            border-width: 1px !important;
          }

          #edurev-embed .paper-sheet {
            width: 116px !important;
            height: 150px !important;
            border-radius: 12px !important;
            opacity: .5 !important;
            background:
              linear-gradient(rgba(155, 145, 118, .42), rgba(155, 145, 118, .42)) 14px 18px/72% 5px no-repeat,
              linear-gradient(rgba(155, 145, 118, .35), rgba(155, 145, 118, .35)) 14px 34px/61% 5px no-repeat,
              linear-gradient(rgba(155, 145, 118, .30), rgba(155, 145, 118, .30)) 14px 50px/49% 5px no-repeat,
              linear-gradient(rgba(155, 145, 118, .38), rgba(155, 145, 118, .38)) 14px 66px/79% 5px no-repeat,
              linear-gradient(rgba(155, 145, 118, .32), rgba(155, 145, 118, .32)) 14px 82px/66% 5px no-repeat,
              linear-gradient(180deg, #fff9e9 0%, #eee5cf 58%, #e1d4b8 100%) !important;
          }

          #edurev-embed .paper-top-left { left: -54px !important; top: -26px !important; }
          #edurev-embed .paper-left { left: -48px !important; top: 55% !important; }
          #edurev-embed .paper-right-stack-a { right: 22px !important; top: 86px !important; }
          #edurev-embed .paper-right-stack-b { right: -42px !important; top: 96px !important; }
          #edurev-embed .paper-right { right: -60px !important; bottom: 50px !important; }
          #edurev-embed .mini-tile,
          #edurev-embed .glass-equation {
            display: none !important;
          }

          #edurev-embed .split {
            display: block !important;
          }

          #edurev-embed .folder-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
            margin-top: 24px !important;
          }

          #edurev-embed .folder {
            min-height: 110px !important;
          }

          #edurev-embed #ed-cards {
            padding: 48px 0 110px !important;
            min-height: 520px !important;
            overflow: visible !important;
          }

          #edurev-embed #ed-cards .stage {
            padding: 0 14px !important;
            overflow: visible !important;
          }

          #edurev-embed .cards-stage {
            width: 100% !important;
            height: 280px !important;
            margin-top: 28px !important;
            overflow: visible !important;
          }

          #edurev-embed .flashcard {
            width: 120px !important;
            height: 158px !important;
            margin: -79px 0 0 -60px !important;
          }

          #edurev-embed .face {
            font-size: 10px !important;
            padding: 12px !important;
            border-radius: 15px !important;
          }

          #edurev-embed .front {
            background:
              repeating-linear-gradient(
                to bottom,
                transparent 0px,
                transparent 22px,
                rgba(180, 170, 150, .45) 23px
              ),
              linear-gradient(180deg, #fffaf0, #e7ddc6);
            color: #0a1020;
          }

          #edurev-embed .back {
            background: linear-gradient(160deg, var(--accent), var(--accent2)) !important;
            color: #071018 !important;
          }

          #edurev-embed .cards-stage.cards-show .flashcard:nth-child(1) { transform: translate3d(-78px, -5px, 18px) rotateZ(-15deg) rotateY(0deg) !important; }
          #edurev-embed .cards-stage.cards-show .flashcard:nth-child(2) { transform: translate3d(-39px, -10px, 18px) rotateZ(-7deg) rotateY(0deg) !important; }
          #edurev-embed .cards-stage.cards-show .flashcard:nth-child(3) { transform: translate3d(0, -15px, 18px) rotateZ(0deg) rotateY(0deg) !important; }
          #edurev-embed .cards-stage.cards-show .flashcard:nth-child(4) { transform: translate3d(39px, -10px, 18px) rotateZ(7deg) rotateY(0deg) !important; }
          #edurev-embed .cards-stage.cards-show .flashcard:nth-child(5) { transform: translate3d(78px, -5px, 18px) rotateZ(15deg) rotateY(0deg) !important; }

          #edurev-embed .cards-stage.cards-flipped .flashcard:nth-child(1) { transform: translate3d(-82px, -5px, 18px) rotateZ(-15deg) rotateY(180deg) !important; }
          #edurev-embed .cards-stage.cards-flipped .flashcard:nth-child(2) { transform: translate3d(-41px, -10px, 18px) rotateZ(-7deg) rotateY(180deg) !important; }
          #edurev-embed .cards-stage.cards-flipped .flashcard:nth-child(3) { transform: translate3d(0, -15px, 18px) rotateZ(0deg) rotateY(180deg) !important; }
          #edurev-embed .cards-stage.cards-flipped .flashcard:nth-child(4) { transform: translate3d(41px, -10px, 18px) rotateZ(7deg) rotateY(180deg) !important; }
          #edurev-embed .cards-stage.cards-flipped .flashcard:nth-child(5) { transform: translate3d(82px, -5px, 18px) rotateZ(15deg) rotateY(180deg) !important; }

          #edurev-embed #ed-mind {
            padding: 64px 12px 130px !important;
            min-height: 760px !important;
            overflow: visible !important;
          }

          #edurev-embed .mind-wrap {
            width: 100% !important;
            height: 460px !important;
            margin: 28px auto 0 !important;
            overflow: visible !important;
          }

          #edurev-embed .mind-wrap svg {
            height: 460px !important;
            overflow: visible !important;
          }

          #edurev-embed .node {
            font-size: 8.5px !important;
            padding: 6px 8px !important;
          }

          #edurev-embed .node.main {
            font-size: 9.5px !important;
          }

          #edurev-embed .dash {
            grid-template-columns: 1fr !important;
            padding: 16px !important;
            gap: 14px !important;
          }

          #edurev-embed #ed-cta {
            padding-bottom: 160px !important;
          }

          #edurev-embed footer {
            padding: 24px 14px 160px !important;
            font-size: 11px !important;
          }

          #edurev-embed .mobile-scroll-hint {
            display: flex !important;
          }
        }
      `}</style>

      {/* Nav Section */}
      <div className="nav">
        <div className="brand">
          <img
            className="brand-logo"
            src="https://drive.google.com/thumbnail?id=1ZdNv54o4YnSIeBNpGJMhZ9ydSV2IGdeA&sz=w1000"
            alt="EducationRev Logo"
            referrerPolicy="no-referrer"
          />
          <div className="brand-text">
            <div className="brand-title">
              EducationRev
            </div>
            <div className="brand-sub">Study Smarter. Stress Less.</div>
          </div>
        </div>
        <div className="links">
          <a href="#ed-beam">Why EducationRev</a>
          <a href="#ed-folders">Study Tools</a>
          <a href="#ed-mind">Mind Maps</a>
          <a href="#ed-dash">Dashboard</a>
        </div>
      </div>



      {/* Hero Section */}
      <section className="scene hero-reference" id="hero">
        <div className="hero-papers" aria-hidden="true">
          <div className="paper-sheet paper-xl paper-top-left"></div>
          <div className="paper-sheet paper-left"></div>
          <div className="paper-sheet paper-right-stack-a"></div>
          <div className="paper-sheet paper-right-stack-b"></div>
          <div className="paper-sheet paper-right"></div>
          <div className="mini-tile tile-left"><span>▣</span></div>
          <div className="mini-tile tile-globe"><span>◎</span></div>
          <div className="mini-tile tile-grid"><span>⊞</span></div>
          <div className="mini-tile tile-file"><span>◰</span></div>
          <div className="glass-equation">a² + b² = c²</div>
        </div>

        <div className="stage center hero-content">
          <span className="eyebrow">
            <span className="ping"></span>AI High School Study Platform · Built For Students
          </span>
          <h1>From school chaos<br />to study clarity.</h1>
          <p className="lead">
            EducationRev turns homework, uploaded documents, class notes and last-minute revision into a calm study
            system with a guided plan, quizzes, flashcards, mind maps and progress tracking.
          </p>

          <div className="actions" style={{ marginBottom: '16px' }}>
            <a className="btn" href="#ed-beam">See how it works ↓</a>
          </div>

          <div className="chips">
            <span>Deadline Tracker</span>
            <span>Resource Search</span>
            <span>Document Library</span>
            <span>Flashcards</span>
            <span>Quizzes</span>
            <span>Assignment Planners</span>
          </div>
        </div>
      </section>

      {/* Watch Section */}
      <section className="scene watch" id="ed-beam">
        <div className="beam-line"></div>
        <div className="stage center">
          <span className="eyebrow">
            <span className="ping"></span>Step 01 — Scan
          </span>
          <h2>EducationRev scans your notes<br />and understands the task.</h2>
          <p className="lead">
            Upload a worksheet, paste notes, search a topic, or drop a PDF. EducationRev reads the content, finds the key
            concepts and prepares study tools around what the student actually needs.
          </p>
        </div>
      </section>

      {/* Folders Section */}
      <section className="scene" id="ed-folders">
        <div className="stage split">
          <div style={{ textAlign: 'left' }}>
            <span className="eyebrow">
              <span className="ping"></span>Step 02 — Organise
            </span>
            <h2 className="text-left mt-2">Everything sorted into<br />subjects and study tools.</h2>
            <p className="mt-4">
              Maths formulas, English quotes, science diagrams and assignment notes become organised subject hubs with
              summaries, quizzes, flashcards and explanations.
            </p>
          </div>
          <div className="folder-grid">
            <div className="folder watch" style={{ '--c1': '#7cf6ff', '--c2': '#5eb5ff' } as CSSProperties}>
              <div className="small">Explanations</div>
              <div className="name">Maths</div>
            </div>
            <div className="folder watch" style={{ '--c1': '#9b8cff', '--c2': '#c46bff' } as CSSProperties}>
              <div className="small">Google topic search</div>
              <div className="name">Science</div>
            </div>
            <div className="folder watch" style={{ '--c1': '#ffb84d', '--c2': '#ff7a59' } as CSSProperties}>
              <div className="small">Uploaded worksheets</div>
              <div className="name">Documents</div>
            </div>
            <div className="folder watch" style={{ '--c1': '#7affae', '--c2': '#3ad19b' } as CSSProperties}>
              <div className="small">Essay support</div>
              <div className="name">English</div>
            </div>
          </div>
        </div>
      </section>

      {/* Cards Section */}
      <section className="scene" id="ed-cards">
        <div className="stage center">
          <span className="eyebrow">
            <span className="ping"></span>Step 03 — Practice
          </span>
          <h2>Quizzes and flashcards<br />build themselves.</h2>
          <p className="lead">
            EducationRev turns notes, documents and search results into revision cards and practice quizzes so students can
            test themselves before exams.
          </p>
          <div className="cards-stage" id="cardsStage">
            <div className="flashcard">
              <div className="face front">Solve:<br />derivative of sin(x)</div>
              <div className="face back">cos(x)</div>
            </div>
            <div className="flashcard">
              <div className="face front">Biology:<br />Mitochondria</div>
              <div className="face back">Energy production</div>
            </div>
            <div className="flashcard">
              <div className="face front">Physics:<br />Force = mass × acceleration</div>
              <div className="face back">F = ma</div>
            </div>
            <div className="flashcard">
              <div className="face front">English:<br />Quote analysis</div>
              <div className="face back">Meaning + context</div>
            </div>
            <div className="flashcard">
              <div className="face front">Chemistry:<br />Carbonic acid</div>
              <div className="face back">H₂CO₃</div>
            </div>
          </div>
        </div>
      </section>

      {/* Mindmap Section */}
      <section className="scene" id="ed-mind">
        <div className="stage center">
          <span className="eyebrow">
            <span className="ping"></span>Step 04 — Connect
          </span>
          <h2>Mind maps grow<br />from confusing topics.</h2>
          <p className="lead">
            EducationRev connects formulas, definitions, causes, examples and essay ideas so students understand the topic
            instead of memorising random notes.
          </p>
          <div className="mind-wrap" id="mindWrap">
            <svg viewBox="0 0 900 520" preserveAspectRatio="none">
              <defs>
                <linearGradient id="edgeGrad" x1="0" x2="1">
                  <stop offset="0" stopColor="#7cf6ff"></stop>
                  <stop offset="1" stopColor="#9b8cff"></stop>
                </linearGradient>
              </defs>
              <path className="edge watch" d="M450,260 C350,180 240,140 160,110"></path>
              <path className="edge watch" d="M450,260 C580,170 700,140 760,100"></path>
              <path className="edge watch" d="M450,260 C320,330 220,400 150,430"></path>
              <path className="edge watch" d="M450,260 C580,330 700,400 770,430"></path>
              <path className="edge watch" d="M450,260 C460,180 460,120 450,60"></path>
              <path className="edge watch" d="M450,260 C440,360 440,440 450,490"></path>
            </svg>
            <div className="node main watch" style={{ left: '50%', top: '50%' }}>Exam Topic</div>
            <div className="node watch" style={{ left: '18%', top: '21%' }}>Key terms</div>
            <div className="node watch" style={{ left: '84%', top: '19%' }}>Examples</div>
            <div className="node watch" style={{ left: '17%', top: '83%' }}>Quiz questions</div>
            <div className="node watch" style={{ left: '85%', top: '83%' }}>Flashcards</div>
            <div className="node watch" style={{ left: '50%', top: '11%' }}>Summary</div>
            <div className="node watch" style={{ left: '50%', top: '94%' }}>Weak areas</div>
          </div>
        </div>
      </section>

      {/* Dashboard Section */}
      <section className="scene" id="ed-dash">
        <div className="stage center">
          <span className="eyebrow">
            <span className="ping"></span>Step 05 — Master
          </span>
          <h2>Your student dashboard<br />assembles around progress.</h2>
          <p className="lead">
            Progress, weak areas, uploaded files, upcoming tests, AI suggestions and subject performance come together
            in one calm student dashboard.
          </p>
          <div className="dash">
            <div className="panel watch">
              <div className="small">Study Progress</div>
              <div className="big">87%</div>
              <p>Tasks completed this week</p>
              <div className="bar">
                <i style={{ '--w': '87%' } as CSSProperties}></i>
              </div>
            </div>
            <div className="panel watch">
              <div className="small">Streak</div>
              <div className="big">7 days 🔥</div>
              <p>Study streak active</p>
            </div>
            <div className="panel watch">
              <div className="small">Next Up</div>
              <p>Science quiz · Tuesday<br />English essay · Thursday<br />Maths practice · Friday</p>
            </div>
            <div className="panel watch">
              <div className="small">AI Suggests</div>
              <p>Revise <b>algebra functions</b> first — this is your weakest quiz area.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="scene" id="ed-cta">
        <div className="stage center">
          <span className="eyebrow">
            <span className="ping"></span>Ready when you are
          </span>
          <h1>Study Smarter.<br />Stress Less.</h1>
          <p className="lead">
            A premium student-side website experience for your high school education app — designed to show AI tutoring,
            document tools, Google search support and revision progress in a way that feels alive.
          </p>
          <div className="actions" style={{ marginBottom: '16px' }}>
            <a className="btn" href="#hero">Back to top ↑</a>
          </div>
        </div>
      </section>

      <footer>
        <div>© 2026 EducationRev · Student-side education platform · Made for learning, clarity and confidence.</div>
        <div style={{ marginTop: '12px', display: 'flex', gap: '20px', justifyContent: 'center', opacity: 0.8 }} className="footer-links">
          <Link to="/terms" style={{ color: '#fff', textDecoration: 'none', fontWeight: 600 }} className="hover:underline">Terms of Use</Link>
          <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>|</span>
          <Link to="/privacy" style={{ color: '#fff', textDecoration: 'none', fontWeight: 600 }} className="hover:underline">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
