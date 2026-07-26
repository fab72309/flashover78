import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Wrench, HeartPulse, Flame } from 'lucide-react';
import { APP_ROUTES } from '../utils/constants';
import PageIntro from '../components/PageIntro';

const MEDICAL_FOLLOWUP_FORM_URL =
  'https://docs.google.com/forms/d/1I2Jt9WSavYKhifDfZa7-DpHyclvl1fW7NgH3AbT-Zks/prefill';

function Brulage() {
  const navigate = useNavigate();
  const [isMedicalPopupOpen, setIsMedicalPopupOpen] = useState(false);

  return (
    <>
      <div className="space-y-4 fade-in">
        <PageIntro
          title="Brûlage"
          subtitle="Centralisez les formulaires, le suivi terrain et les documents utiles pour les séquences de brûlage."
        />

        <a
          href="https://forms.gle/UkR2NHodKJHswmAV6"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full btn-primary-gradient py-6 rounded-squircle flex items-center justify-center relative active:scale-[0.98] font-bold text-xl gap-3"
        >
          <FileText size={22} />
          MAIN COURANTE
        </a>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="https://forms.gle/4os4pqSkmowsZuJ58"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-surface-container-lowest text-on-surface py-6 rounded-squircle flex items-center justify-center text-center relative shadow-ambient-sm transition-all hover:shadow-ambient active:scale-[0.98] font-bold text-lg gap-2"
          >
            <Wrench size={20} className="text-primary" />
            DEMANDE DE RÉPARATION
          </a>
          <button
            type="button"
            onClick={() => setIsMedicalPopupOpen(true)}
            className="w-full bg-surface-container-lowest text-on-surface py-6 rounded-squircle flex items-center justify-center text-center relative shadow-ambient-sm transition-all hover:shadow-ambient active:scale-[0.98] font-bold text-lg gap-2"
          >
            <HeartPulse size={20} className="text-primary" />
            SUIVI MÉDICAL
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => navigate(APP_ROUTES.BRULAGE_MLB)}
            className="w-full bg-surface-container-lowest text-on-surface py-6 rounded-squircle flex items-center justify-center text-center relative shadow-ambient-sm transition-all hover:shadow-ambient active:scale-[0.98] font-bold text-lg gap-2"
          >
            <Flame size={20} className="text-primary" />
            BRULAGE TDL / FO
          </button>
          <button
            onClick={() => navigate(APP_ROUTES.BRULAGE_MAF)}
            className="w-full bg-surface-container-lowest text-on-surface py-6 rounded-squircle flex items-center justify-center text-center relative shadow-ambient-sm transition-all hover:shadow-ambient active:scale-[0.98] font-bold text-lg gap-2"
          >
            <Flame size={20} className="text-primary" />
            BRULAGE MAF
          </button>
        </div>

      </div>

      {isMedicalPopupOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-on-surface/50 p-4 modal-enter"
          role="dialog"
          aria-modal="true"
          aria-labelledby="medical-followup-title"
          onClick={() => setIsMedicalPopupOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-squircle bg-surface-container-lowest p-5 shadow-ambient-lg space-y-3"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-1">
              <h2 id="medical-followup-title" className="text-xl font-bold text-on-surface">
                Suivi médical
              </h2>
              <p className="text-sm text-on-surface-variant">
                Sélectionnez le formulaire souhaité.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled
                className="w-full rounded-squircle-sm bg-orange-300 px-4 py-4 text-white font-bold text-lg opacity-95"
              >
                FORBAT
              </button>
              <a
                href={MEDICAL_FOLLOWUP_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-squircle-sm bg-orange-500 px-4 py-4 flex items-center justify-center font-bold text-lg text-white"
              >
                FOR INC
              </a>
              <button
                type="button"
                disabled
                className="w-full rounded-squircle-sm bg-orange-700 px-4 py-4 text-white font-bold text-lg opacity-95"
              >
                RSFR
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsMedicalPopupOpen(false)}
              className="w-full rounded-squircle-sm bg-surface-container-high px-4 py-3 text-on-surface font-semibold"
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default Brulage;
