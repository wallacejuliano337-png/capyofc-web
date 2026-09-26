import { useEffect, useState, type CSSProperties } from "react";
import { ErrorNotice, useTask } from "../../components/ui";
import { audioSettings, useAudioSettings } from "../../services/audio-settings";
import { MicrophoneMeter } from "../../services/microphone-meter";
export function VoiceSettings() {
  const audio = useAudioSettings();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [meter] = useState(() => new MicrophoneMeter());
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const task = useTask();
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void navigator.mediaDevices
        .enumerateDevices()
        .then((value) => {
          if (active) setDevices(value);
        })
        .catch(() => {});
    };
    refresh();
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => {
      active = false;
      meter.stop();
      navigator.mediaDevices.removeEventListener("devicechange", refresh);
    };
  }, [meter]);
  const stop = () => {
    meter.stop();
    setTesting(false);
    setLevel(0);
  };
  return (
    <>
      <h2>Voz e vídeo</h2>
      <p className="muted">
        Configure os dispositivos usados nas salas de voz.
      </p>
      <ErrorNotice text={task.error} />
      <h3 className="settings-section-title">Voz</h3>
      <div className="settings-device-grid">
        {(["audioinput", "audiooutput"] as const).map((kind) => (
          <label key={kind}>
            {kind === "audioinput" ? "Microfone" : "Saída de áudio"}
            <select
              aria-label={
                kind === "audioinput" ? "Microfone" : "Saída de áudio"
              }
              value={kind === "audioinput" ? audio.input : audio.output}
              disabled={
                task.busy ||
                (kind === "audiooutput" &&
                  !("setSinkId" in HTMLMediaElement.prototype))
              }
              onChange={(e) => {
                stop();
                void task.run(() => audioSettings.select(kind, e.target.value));
              }}
            >
              <option value="default">Padrão do sistema</option>
              {devices
                .filter(
                  (d) =>
                    d.kind === kind && d.deviceId && d.deviceId !== "default",
                )
                .map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label ||
                      `${kind === "audioinput" ? "Microfone" : "Saída"} ${i + 1}`}
                  </option>
                ))}
            </select>
          </label>
        ))}
      </div>
      {!("setSinkId" in HTMLMediaElement.prototype) && (
        <p className="muted">
          Este ambiente utiliza a saída padrão do sistema.
        </p>
      )}
      <div className="settings-volume-grid">
        <label className="settings-slider">
          Volume do microfone <span>Controlado pelo sistema</span>
          <input
            aria-label="Volume do microfone"
            type="range"
            min="0"
            max="100"
            value="100"
            disabled
          />
        </label>

        <label className="settings-slider">
          Volume de saída <span>{Math.round(audio.volume * 100)}%</span>
          <input
            aria-label="Volume de saída"
            style={
              { "--range-fill": `${audio.volume * 100}%` } as CSSProperties
            }
            type="range"
            min="0"
            max="100"
            value={Math.round(audio.volume * 100)}
            onChange={(e) =>
              audioSettings.setVolume(Number(e.target.value) / 100)
            }
          />
        </label>
      </div>
      <p className="settings-hint">
        O ajuste de ganho não está disponível nesta integração. Use as
        configurações de som do Windows.
      </p>
      <h3 className="settings-section-title">Teste do microfone</h3>
      <p className="muted">
        Fale para conferir o nível captado. O teste não reproduz áudio nem
        transmite para a sala.
      </p>
      <div className="microphone-test-controls">
        <button
          className="primary"
          disabled={task.busy}
          onClick={() => {
            if (testing) {
              stop();
              return;
            }
            void task.run(async () => {
              if (await meter.start(audio.input, setLevel)) {
                setTesting(true);
                setDevices(await navigator.mediaDevices.enumerateDevices());
              }
            });
          }}
        >
          {testing ? "Parar teste" : "Testar microfone"}
        </button>
        <div
          className="microphone-bars"
          role="meter"
          aria-label="Nível do microfone"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level)}
        >
          {Array.from({ length: 40 }, (_, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={testing && level > index * 2.5 ? "lit" : ""}
              style={{ height: `${12 + [0, 8, 16, 24, 16, 8][index % 6]}px` }}
            />
          ))}
        </div>
      </div>
      <p className="settings-hint">
        {testing
          ? "Teste ativo — fale no microfone selecionado."
          : "O microfone será solicitado somente ao iniciar o teste."}
      </p>
      <h3 className="settings-section-title">
        Perfil de entrada <small>Em breve</small>
      </h3>
      <fieldset
        className="settings-input-profiles"
        disabled
        aria-label="Perfil de entrada indisponível"
      >
        {["Isolamento de Voz", "Estúdio", "Personalizado"].map((label) => (
          <label key={label}>
            <input type="radio" name="input-profile" />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="settings-sensitivity">
        <label>
          <span>
            Ajustar automaticamente a sensibilidade de entrada{" "}
            <small>Em breve</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            disabled
            aria-label="Ajustar automaticamente a sensibilidade de entrada"
          />
        </label>
        <label className="settings-slider">
          Sensibilidade
          <input
            type="range"
            aria-label="Sensibilidade"
            min="0"
            max="100"
            value="50"
            disabled
          />
        </label>
      </div>
      <p className="settings-hint">
        Perfis e sensibilidade ainda não estão disponíveis. Nenhum processamento
        adicional está ativo.
      </p>
      <p className="settings-hint">
        As escolhas de áudio valem nesta execução do aplicativo. Abrir ou fechar
        esta tela mantém sua sala e transmissão.
      </p>
    </>
  );
}
