import type { UiLang } from "./config";

/**
 * Interface translations. Keys are the English source strings used in code; the
 * English copy itself is the fallback, so untranslated strings still render.
 * Placeholders use `{name}` and are filled by the `t()` helper.
 *
 * Only Portuguese UI scaffolding is active for sub-B1 learners. Legacy entries
 * for other languages may remain in this table, but translate() intentionally
 * falls back to English for them.
 */
export const messages: Record<string, Partial<Record<UiLang, string>>> = {
  /* ── navigation ─────────────────────────────────────────── */
  Discover: { de: "Entdecken", es: "Descubrir", fr: "Découvrir", ja: "発見", pt: "Descobrir", ar: "اكتشف", cs: "Objevit", it: "Scopri", ko: "탐색", nl: "Ontdekken", zh: "发现" },
  Study: { de: "Lernen", es: "Estudiar", fr: "Étudier", ja: "学習", pt: "Estudar", ar: "ادرس", cs: "Studovat", it: "Studia", ko: "학습", nl: "Studeren", zh: "学习" },
  Practice: { de: "Üben", es: "Practicar", fr: "Pratiquer", ja: "練習", pt: "Praticar", ar: "تدرّب", cs: "Procvičovat", it: "Pratica", ko: "연습", nl: "Oefenen", zh: "练习" },
  Correct: { de: "Korrigieren", es: "Corregir", fr: "Corriger", ja: "添削", pt: "Corrigir", ar: "تصحيح", cs: "Opravit", it: "Correggi", ko: "교정", nl: "Corrigeren", zh: "纠正" },
  Speak: { de: "Sprechen", es: "Hablar", fr: "Parler", ja: "話す", pt: "Falar", ar: "تحدث", cs: "Mluvit", it: "Parla", ko: "말하기", nl: "Spreken", zh: "口语" },
  Speech: { de: "Sprache", es: "Voz", fr: "Voix", ja: "音声", pt: "Voz", ar: "نطق", cs: "Řeč", it: "Voce", ko: "음성", nl: "Spraak", zh: "语音" },
  Tools: { de: "Werkzeuge", es: "Herramientas", fr: "Outils", ja: "ツール", pt: "Ferramentas", ar: "أدوات", cs: "Nástroje", it: "Strumenti", ko: "도구", nl: "Tools", zh: "工具" },
  Settings: { de: "Einstellungen", es: "Ajustes", fr: "Paramètres", ja: "設定", pt: "Configurações", ar: "الإعدادات", cs: "Nastavení", it: "Impostazioni", ko: "설정", nl: "Instellingen", zh: "设置" },
  Learn: { pt: "Aprender" },

  /* ── common actions ─────────────────────────────────────── */
  Cancel: { de: "Abbrechen", es: "Cancelar", fr: "Annuler", ja: "キャンセル", pt: "Cancelar", ar: "إلغاء", cs: "Zrušit", it: "Annulla", ko: "취소", nl: "Annuleren", zh: "取消" },
  Back: { de: "Zurück", es: "Atrás", fr: "Retour", ja: "戻る", pt: "Voltar", ar: "رجوع", cs: "Zpět", it: "Indietro", ko: "뒤로", nl: "Terug", zh: "返回" },
  Continue: { de: "Weiter", es: "Continuar", fr: "Continuer", ja: "続ける", pt: "Continuar", ar: "متابعة", cs: "Pokračovat", it: "Continua", ko: "계속", nl: "Doorgaan", zh: "继续" },
  Go: { pt: "Ir" },
  "Mark as not done": { pt: "Marcar como não concluído" },
  "Mark as done": { pt: "Marcar como concluído" },

  /* ── language names ────────────────────────────────────── */
  English: { de: "Englisch", es: "Inglés", fr: "Anglais", ja: "英語", pt: "Inglês", ar: "الإنجليزية", cs: "Angličtina", it: "Inglese", ko: "영어", nl: "Engels", zh: "英语" },
  German: { de: "Deutsch", es: "Alemán", fr: "Allemand", ja: "ドイツ語", pt: "Alemão", ar: "الألمانية", cs: "Němčina", it: "Tedesco", ko: "독일어", nl: "Duits", zh: "德语" },
  Spanish: { de: "Spanisch", es: "Español", fr: "Espagnol", ja: "スペイン語", pt: "Espanhol", ar: "الإسبانية", cs: "Španělština", it: "Spagnolo", ko: "스페인어", nl: "Spaans", zh: "西班牙语" },
  French: { de: "Französisch", es: "Francés", fr: "Français", ja: "フランス語", pt: "Francês", ar: "الفرنسية", cs: "Francouzština", it: "Francese", ko: "프랑스어", nl: "Frans", zh: "法语" },
  Japanese: { de: "Japanisch", es: "Japonés", fr: "Japonais", ja: "日本語", pt: "Japonês", ar: "اليابانية", cs: "Japonština", it: "Giapponese", ko: "일본어", nl: "Japans", zh: "日语" },
  Portuguese: { de: "Portugiesisch", es: "Portugués", fr: "Portugais", ja: "ポルトガル語", pt: "Português", ar: "البرتغالية", cs: "Portugalština", it: "Portoghese", ko: "포르투갈어", nl: "Portugees", zh: "葡萄牙语" },
  Arabic: { de: "Arabisch", es: "Árabe", fr: "Arabe", ja: "アラビア語", pt: "Árabe", ar: "العربية", cs: "Arabština", it: "Arabo", ko: "아랍어", nl: "Arabisch", zh: "阿拉伯语" },
  Czech: { de: "Tschechisch", es: "Checo", fr: "Tchèque", ja: "チェコ語", pt: "Tcheco", ar: "التشيكية", cs: "Čeština", it: "Ceco", ko: "체코어", nl: "Tsjechisch", zh: "捷克语" },
  Italian: { de: "Italienisch", es: "Italiano", fr: "Italien", ja: "イタリア語", pt: "Italiano", ar: "الإيطالية", cs: "Italština", it: "Italiano", ko: "이탈리아어", nl: "Italiaans", zh: "意大利语" },
  Korean: { de: "Koreanisch", es: "Coreano", fr: "Coréen", ja: "韓国語", pt: "Coreano", ar: "الكورية", cs: "Korejština", it: "Coreano", ko: "한국어", nl: "Koreaans", zh: "韩语" },
  Dutch: { de: "Niederländisch", es: "Neerlandés", fr: "Néerlandais", ja: "オランダ語", pt: "Holandês", ar: "الهولندية", cs: "Nizozemština", it: "Olandese", ko: "네덜란드어", nl: "Nederlands", zh: "荷兰语" },
  Chinese: { de: "Chinesisch", es: "Chino", fr: "Chinois", ja: "中国語", pt: "Chinês", ar: "الصينية", cs: "Čínština", it: "Cinese", ko: "중국어", nl: "Chinees", zh: "中文" },

  /* ── learning plan card ─────────────────────────────────── */
  "Learning plan": { de: "Lernplan", es: "Plan de aprendizaje", fr: "Plan d'apprentissage", ja: "学習プラン", pt: "Plano de aprendizado", ar: "خطة التعلّم", cs: "Studijní plán", it: "Piano di studio", ko: "학습 플랜", nl: "Leerplan", zh: "学习计划" },
  "No plan yet": { de: "Noch kein Plan", es: "Aún no hay plan", fr: "Pas encore de plan", ja: "まだプランがありません", pt: "Nenhum plano ainda", ar: "لا توجد خطة بعد", cs: "Zatím žádný plán", it: "Nessun piano", ko: "아직 플랜이 없습니다", nl: "Nog geen plan", zh: "还没有计划" },
  "Start a ready-made plan for your level, or customize one with AI.": {
    de: "Starte einen fertigen Plan für dein Niveau oder passe einen mit KI an.",
    es: "Empieza un plan listo para tu nivel o personaliza uno con IA.",
    fr: "Lancez un plan prêt à l'emploi pour votre niveau, ou personnalisez-en un avec l'IA.",
    ja: "あなたのレベルに合った既成プランを始めるか、AIでカスタマイズしましょう。",
    pt: "Comece um plano pronto para o seu nível ou personalize um com IA.",
    ar: "ابدأ بخطة جاهزة تناسب مستواك، أو خصّص واحدة باستخدام الذكاء الاصطناعي.",
    cs: "Začni s hotovým plánem pro svou úroveň nebo si jej přizpůsob pomocí AI.",
    it: "Inizia un piano pronto per il tuo livello o personalizzane uno con l'IA.",
    ko: "당신의 레벨에 맞는 기성 플랜을 시작하거나 AI로 맞춤 설정하세요.",
    nl: "Start een kant-en-klaar plan voor jouw niveau, of pas er een aan met AI.",
    zh: "为你的水平开始一个现成的计划，或用 AI 定制一个。",
  },
  "Create plan": { de: "Plan erstellen", es: "Crear plan", fr: "Créer un plan", ja: "プランを作成", pt: "Criar plano", ar: "إنشاء خطة", cs: "Vytvořit plán", it: "Crea piano", ko: "플랜 만들기", nl: "Plan maken", zh: "创建计划" },
  "Creating…": { de: "Wird erstellt…", es: "Creando…", fr: "Création…", ja: "作成中…", pt: "Criando…", ar: "جارٍ الإنشاء…", cs: "Vytváří se…", it: "Creazione…", ko: "만드는 중…", nl: "Maken…", zh: "创建中…" },
  "Customize with AI": { de: "Mit KI anpassen", es: "Personalizar con IA", fr: "Personnaliser avec l'IA", ja: "AIでカスタマイズ", pt: "Personalizar com IA", ar: "تخصيص بالذكاء الاصطناعي", cs: "Přizpůsobit s AI", it: "Personalizza con l'IA", ko: "AI로 맞춤 설정", nl: "Aanpassen met AI", zh: "用 AI 定制" },
  "Plan complete": { de: "Plan abgeschlossen", es: "Plan completado", fr: "Plan terminé", ja: "プラン完了", pt: "Plano concluído", ar: "اكتملت الخطة", cs: "Plán dokončen", it: "Piano completato", ko: "플랜 완료", nl: "Plan voltooid", zh: "计划完成" },
  "You finished your {days}-day plan — great work!": {
    de: "Du hast deinen {days}-Tage-Plan abgeschlossen — großartig!",
    es: "¡Has terminado tu plan de {days} días, excelente trabajo!",
    fr: "Vous avez terminé votre plan de {days} jours — bravo !",
    ja: "{days}日間のプランを達成しました — お見事です！",
    pt: "Você concluiu seu plano de {days} dias — ótimo trabalho!",
    ar: "لقد أكملت خطتك التي تستمر {days} يومًا — عمل رائع!",
    cs: "Dokončil jsi svůj {days}denní plán — skvělá práce!",
    it: "Hai completato il tuo piano di {days} giorni — ottimo lavoro!",
    ko: "{days}일 플랜을 완료했어요 — 훌륭해요!",
    nl: "Je hebt je {days}-daagse plan voltooid — goed gedaan!",
    zh: "你完成了 {days} 天的计划——干得好！",
  },
  "Ready to start a new one?": { de: "Bereit für einen neuen?", es: "¿Listo para empezar otro?", fr: "Prêt à en commencer un nouveau ?", ja: "新しく始めますか？", pt: "Pronto para começar outro?", ar: "هل أنت مستعد لبدء خطة جديدة؟", cs: "Začneš nový?", it: "Pronto a iniziarne uno nuovo?", ko: "새로 시작할까요?", nl: "Klaar voor een nieuwe?", zh: "准备好开始新的了吗？" },
  "Start new plan": { de: "Neuen Plan starten", es: "Empezar nuevo plan", fr: "Démarrer un nouveau plan", ja: "新しいプランを開始", pt: "Iniciar novo plano", ar: "ابدأ خطة جديدة", cs: "Spustit nový plán", it: "Inizia nuovo piano", ko: "새 플랜 시작", nl: "Nieuw plan starten", zh: "开始新计划" },
  "Starting…": { de: "Wird gestartet…", es: "Empezando…", fr: "Démarrage…", ja: "開始中…", pt: "Iniciando…", ar: "جارٍ البدء…", cs: "Spouští se…", it: "Avvio…", ko: "시작 중…", nl: "Starten…", zh: "开始中…" },
  "Delete plan": { de: "Plan löschen", es: "Eliminar plan", fr: "Supprimer le plan", ja: "プランを削除", pt: "Excluir plano", ar: "حذف الخطة", cs: "Smazat plán", it: "Elimina piano", ko: "플랜 삭제", nl: "Plan verwijderen", zh: "删除计划" },
  "Done ✓": { de: "Fertig ✓", es: "Hecho ✓", fr: "Terminé ✓", ja: "完了 ✓", pt: "Concluído ✓", ar: "تم ✓", cs: "Hotovo ✓", it: "Fatto ✓", ko: "완료 ✓", nl: "Klaar ✓", zh: "完成 ✓" },
  tasks: { de: "Aufgaben", es: "tareas", fr: "tâches", ja: "タスク", pt: "tarefas", ar: "مهام", cs: "úkoly", it: "attività", ko: "과제", nl: "taken", zh: "任务" },
  "Today · Day {day} of {total}": {
    de: "Heute · Tag {day} von {total}",
    es: "Hoy · Día {day} de {total}",
    fr: "Aujourd'hui · Jour {day} sur {total}",
    ja: "今日 · {total}日中{day}日目",
    pt: "Hoje · Dia {day} de {total}",
    ar: "اليوم · اليوم {day} من {total}",
    cs: "Dnes · Den {day} z {total}",
    it: "Oggi · Giorno {day} di {total}",
    ko: "오늘 · {total}일 중 {day}일째",
    nl: "Vandaag · Dag {day} van {total}",
    zh: "今天 · 第 {day}/{total} 天",
  },
  "~{min} min today": {
    de: "~{min} Min. heute",
    es: "~{min} min hoy",
    fr: "~{min} min aujourd'hui",
    ja: "今日 ~{min}分",
    pt: "~{min} min hoje",
    ar: "~{min} دقيقة اليوم",
    cs: "~{min} min dnes",
    it: "~{min} min oggi",
    ko: "오늘 ~{min}분",
    nl: "~{min} min vandaag",
    zh: "今天约 {min} 分钟",
  },
  "Delete this plan? This cannot be undone.": {
    de: "Diesen Plan löschen? Das kann nicht rückgängig gemacht werden.",
    es: "¿Eliminar este plan? Esto no se puede deshacer.",
    fr: "Supprimer ce plan ? Cette action est irréversible.",
    ja: "このプランを削除しますか？元に戻せません。",
    pt: "Excluir este plano? Isso não pode ser desfeito.",
    ar: "حذف هذه الخطة؟ لا يمكن التراجع عن ذلك.",
    cs: "Smazat tento plán? Tuto akci nelze vrátit zpět.",
    it: "Eliminare questo piano? L'azione non può essere annullata.",
    ko: "이 플랜을 삭제할까요? 되돌릴 수 없습니다.",
    nl: "Dit plan verwijderen? Dit kan niet ongedaan worden gemaakt.",
    zh: "删除此计划？此操作无法撤销。",
  },
  "Phase {phase}": {
    de: "Phase {phase}",
    es: "Fase {phase}",
    fr: "Phase {phase}",
    ja: "フェーズ {phase}",
    pt: "Fase {phase}",
    ar: "المرحلة {phase}",
    cs: "Fáze {phase}",
    it: "Fase {phase}",
    ko: "{phase}단계",
    nl: "Fase {phase}",
    zh: "第 {phase} 阶段",
  },

  /* ── onboarding: section labels ─────────────────────────── */
  Welcome: { de: "Willkommen", es: "Bienvenido", fr: "Bienvenue", ja: "ようこそ", pt: "Bem-vindo", ar: "مرحبًا", cs: "Vítejte", it: "Benvenuto", ko: "환영합니다", nl: "Welkom", zh: "欢迎" },
  "Your routine": { de: "Deine Routine", es: "Tu rutina", fr: "Votre routine", ja: "あなたのルーティン", pt: "Sua rotina", ar: "روتينك", cs: "Tvoje rutina", it: "La tua routine", ko: "당신의 루틴", nl: "Jouw routine", zh: "你的日常" },
  "The method": { de: "Die Methode", es: "El método", fr: "La méthode", ja: "メソッド", pt: "O método", ar: "الطريقة", cs: "Metoda", it: "Il metodo", ko: "방법", nl: "De methode", zh: "方法" },
  "Learn with a loop, not a pile of cards": {
    de: "Lerne mit einem Kreislauf, nicht mit einem Kartenstapel",
    es: "Aprende con un bucle, no con un montón de tarjetas",
    fr: "Apprenez avec une boucle, pas avec une pile de cartes",
    ja: "カードの山ではなく、ループで学ぼう",
    pt: "Aprenda com um ciclo, não com uma pilha de cartões",
    ar: "تعلّم عبر حلقة متكررة، لا عبر كومة من البطاقات",
    cs: "Uč se ve smyčce, ne s hromadou kartiček",
    it: "Impara con un ciclo, non con un mucchio di flashcard",
    ko: "카드 더미가 아니라 반복 루프로 학습하세요",
    nl: "Leer met een lus, niet met een stapel kaarten",
    zh: "用循环学习，而不是一堆卡片",
  },
  "Turn real English into daily practice": {
    pt: "Transforme inglês real em prática diária",
  },
  "PhraseLoop turns useful English phrases into one daily routine: save them, review them, then practice using them.": {
    pt: "O PhraseLoop transforma frases úteis em inglês numa rotina diária: salvar, revisar e praticar o uso.",
  },
  "PhraseLoop turns English you watch or read, plus mistakes you make, into one daily routine: save, review, fix, repeat.": {
    pt: "O PhraseLoop transforma o inglês que você assiste ou lê, mais os erros que você comete, numa rotina diária: salvar, revisar, corrigir e repetir.",
  },
  "Start with a demo, then bring videos, articles, or PDFs later.": {
    pt: "Comece com um demo; depois, traga vídeos, artigos ou PDFs.",
  },
  "Start with phrases you can hear, then bring videos, articles, or PDFs later.": {
    pt: "Comece com frases que você pode ouvir; depois, traga vídeos, artigos ou PDFs.",
  },
  "Source audio": { pt: "Áudio da fonte" },
  "Daily review": { pt: "Revisão diária" },
  "Review a few practice phrases each day.": {
    pt: "Revise algumas frases para praticar todos os dias.",
  },
  "Correct one phrase you wrote, then save the fix for review.": {
    pt: "Corrija uma frase sua e salve a versão certa para revisar.",
  },
  "Calibrate the first week": {
    de: "Kalibriere die erste Woche",
    es: "Calibra la primera semana",
    fr: "Calibrez la première semaine",
    ja: "最初の1週間を調整しましょう",
    pt: "Calibre a primeira semana",
    ar: "اضبط الأسبوع الأول",
    cs: "Nastav první týden",
    it: "Calibra la prima settimana",
    ko: "첫 주를 설정하세요",
    nl: "Stel de eerste week af",
    zh: "校准第一周",
  },
  "These choices only guide defaults. You can change them while working.": {
    de: "Diese Auswahl steuert nur Voreinstellungen. Du kannst sie jederzeit ändern.",
    es: "Estas opciones solo guían los valores predeterminados. Puedes cambiarlas mientras trabajas.",
    fr: "Ces choix ne définissent que des valeurs par défaut. Vous pouvez les modifier en cours de route.",
    ja: "これらの選択は初期設定の目安です。作業しながら変更できます。",
    pt: "Estas escolhas apenas orientam os padrões. Você pode alterá-las enquanto usa o app.",
    ar: "هذه الخيارات تحدد القيم الافتراضية فقط. يمكنك تغييرها أثناء العمل.",
    cs: "Tyto volby jen určují výchozí nastavení. Můžeš je kdykoli změnit.",
    it: "Queste scelte guidano solo i valori predefiniti. Puoi cambiarle mentre lavori.",
    ko: "이 선택은 기본값을 안내할 뿐입니다. 사용 중에 언제든 변경할 수 있습니다.",
    nl: "Deze keuzes bepalen alleen standaardwaarden. Je kunt ze altijd aanpassen.",
    zh: "这些选择只是设定默认值，使用过程中可随时更改。",
  },
  "Your dashboard will pick the next move": {
    de: "Dein Dashboard wählt den nächsten Schritt",
    es: "Tu panel elegirá el siguiente paso",
    fr: "Votre tableau de bord choisira la prochaine étape",
    ja: "ダッシュボードが次の一手を選びます",
    pt: "Seu painel escolherá o próximo passo",
    ar: "ستختار لوحتك الخطوة التالية",
    cs: "Tvůj přehled vybere další krok",
    it: "La tua dashboard sceglierà la prossima mossa",
    ko: "대시보드가 다음 단계를 골라 줍니다",
    nl: "Je dashboard kiest de volgende stap",
    zh: "你的仪表盘会选择下一步",
  },
  "PhraseLoop turns real English, your writing, and your speaking into one daily routine: capture, remember, produce, then reinforce what is still weak.": {
    de: "PhraseLoop macht echtes Englisch, dein Schreiben und dein Sprechen zu einer täglichen Routine: sammeln, merken, produzieren und dann stärken, was noch schwach ist.",
    es: "PhraseLoop convierte el inglés real, tu escritura y tu habla en una rutina diaria: captura, recuerda, produce y refuerza lo que todavía está débil.",
    fr: "PhraseLoop transforme l'anglais réel, vos écrits et votre expression orale en une routine quotidienne : capter, mémoriser, produire, puis renforcer ce qui reste fragile.",
    ja: "PhraseLoopは本物の英語、あなたのライティング、スピーキングを1つの毎日の流れにします。集める、覚える、使う、そしてまだ弱いところを強化します。",
    pt: "O PhraseLoop transforma inglês real, sua escrita e sua fala em uma rotina diária: capturar, lembrar, produzir e reforçar o que ainda está fraco.",
    ar: "يحوّل PhraseLoop الإنجليزية الحقيقية وكتابتك وتحدثك إلى روتين يومي واحد: التقط، تذكّر، أنتج، ثم عزّز ما لا يزال ضعيفًا.",
    cs: "PhraseLoop mění skutečnou angličtinu, tvoje psaní i mluvení v jednu denní rutinu: zachytit, zapamatovat, použít a potom posílit slabá místa.",
    it: "PhraseLoop trasforma l'inglese reale, la tua scrittura e il tuo parlato in una routine quotidiana: cattura, ricorda, produci e rinforza ciò che è ancora debole.",
    ko: "PhraseLoop는 실제 영어, 글쓰기, 말하기를 하나의 일일 루틴으로 만듭니다. 모으고, 기억하고, 사용한 뒤 아직 약한 부분을 강화하세요.",
    nl: "PhraseLoop maakt van echt Engels, je schrijven en je spreken één dagelijkse routine: verzamelen, onthouden, produceren en daarna versterken wat nog zwak is.",
    zh: "PhraseLoop 把真实英语、你的写作和口语变成一个每日流程：收集、记住、输出，然后强化仍然薄弱的部分。",
  },
  "Real input": { de: "Echter Input", es: "Input real", fr: "Entrée réelle", ja: "本物のインプット", pt: "Input real", ar: "مدخلات حقيقية", cs: "Skutečný vstup", it: "Input reale", ko: "실제 입력", nl: "Echte input", zh: "真实输入" },
  "Mistake drills": { pt: "Treino de erros" },
  "Mine useful language from videos, articles, and PDFs.": {
    de: "Gewinne nützliche Sprache aus Videos, Artikeln und PDFs.",
    es: "Extrae lenguaje útil de videos, artículos y PDF.",
    fr: "Extrayez du langage utile de vidéos, d'articles et de PDF.",
    ja: "動画、記事、PDFから役立つ表現を掘り出します。",
    pt: "Extraia linguagem útil de vídeos, artigos e PDFs.",
    ar: "استخرج لغة مفيدة من الفيديوهات والمقالات وملفات PDF.",
    cs: "Vytěž užitečný jazyk z videí, článků a PDF.",
    it: "Estrai lingua utile da video, articoli e PDF.",
    ko: "동영상, 글, PDF에서 유용한 표현을 뽑아내세요.",
    nl: "Haal nuttige taal uit video's, artikelen en pdf's.",
    zh: "从视频、文章和 PDF 中提取有用表达。",
  },
  "Active recall": { de: "Aktives Erinnern", es: "Recuerdo activo", fr: "Rappel actif", ja: "能動的想起", pt: "Recordação ativa", ar: "استدعاء نشط", cs: "Aktivní vybavování", it: "Richiamo attivo", ko: "능동 회상", nl: "Actief herinneren", zh: "主动回忆" },
  "Generate focused cards that test understanding.": {
    de: "Erzeuge fokussierte Karten, die Verständnis prüfen.",
    es: "Genera tarjetas enfocadas que ponen a prueba la comprensión.",
    fr: "Générez des cartes ciblées qui testent la compréhension.",
    ja: "理解を試す集中カードを作ります。",
    pt: "Gere cartões focados que testam a compreensão.",
    ar: "أنشئ بطاقات مركزة تختبر الفهم.",
    cs: "Vytvoř cílené kartičky, které ověří porozumění.",
    it: "Genera schede mirate che verificano la comprensione.",
    ko: "이해도를 확인하는 집중 카드를 만드세요.",
    nl: "Maak gerichte kaarten die begrip testen.",
    zh: "生成测试理解的专注卡片。",
  },
  Output: { de: "Produktion", es: "Producción", fr: "Production", ja: "アウトプット", pt: "Produção", ar: "الإنتاج", cs: "Výstup", it: "Produzione", ko: "출력", nl: "Output", zh: "输出" },
  "Practice speaking or correct what you wrote.": {
    de: "Übe Sprechen oder korrigiere, was du geschrieben hast.",
    es: "Practica hablar o corrige lo que escribiste.",
    fr: "Entraînez-vous à parler ou corrigez ce que vous avez écrit.",
    ja: "話す練習をするか、書いたものを添削します。",
    pt: "Pratique fala ou corrija o que você escreveu.",
    ar: "تدرّب على التحدث أو صحّح ما كتبته.",
    cs: "Procvič mluvení nebo oprav, co jsi napsal.",
    it: "Esercitati a parlare o correggi ciò che hai scritto.",
    ko: "말하기를 연습하거나 쓴 글을 교정하세요.",
    nl: "Oefen met spreken of verbeter wat je schreef.",
    zh: "练习口语或纠正你写的内容。",
  },
  Reinforcement: { de: "Verstärkung", es: "Refuerzo", fr: "Renforcement", ja: "強化", pt: "Reforço", ar: "تعزيز", cs: "Posílení", it: "Rinforzo", ko: "강화", nl: "Versterking", zh: "强化" },
  "Let weak spots decide the next drill.": {
    de: "Lass Schwachstellen die nächste Übung bestimmen.",
    es: "Deja que los puntos débiles decidan el siguiente ejercicio.",
    fr: "Laissez les points faibles décider du prochain exercice.",
    ja: "弱いところに次の練習を決めさせます。",
    pt: "Deixe os pontos fracos decidirem o próximo exercício.",
    ar: "دع نقاط الضعف تحدد التدريب التالي.",
    cs: "Nech slabá místa určit další cvičení.",
    it: "Lascia che i punti deboli decidano il prossimo esercizio.",
    ko: "약한 부분이 다음 연습을 정하게 하세요.",
    nl: "Laat zwakke plekken de volgende oefening bepalen.",
    zh: "让薄弱点决定下一次练习。",
  },

  /* ── onboarding: fields ─────────────────────────────────── */
  "Where are you starting?": { de: "Wo fängst du an?", es: "¿Dónde empiezas?", fr: "Où en êtes-vous ?", ja: "どこから始めますか？", pt: "Onde você está começando?", ar: "من أين تبدأ؟", cs: "Kde začínáš?", it: "Da dove parti?", ko: "어디서 시작하나요?", nl: "Waar begin je?", zh: "你从哪里开始？" },
  Beginner: { de: "Anfänger", es: "Principiante", fr: "Débutant", ja: "初級", pt: "Iniciante", ar: "مبتدئ", cs: "Začátečník", it: "Principiante", ko: "초급", nl: "Beginner", zh: "初学者" },
  Intermediate: { de: "Mittelstufe", es: "Intermedio", fr: "Intermédiaire", ja: "中級", pt: "Intermediário", ar: "متوسط", cs: "Středně pokročilý", it: "Intermedio", ko: "중급", nl: "Gemiddeld", zh: "中级" },
  "Your language": { de: "Deine Sprache", es: "Tu idioma", fr: "Votre langue", ja: "あなたの言語", pt: "Seu idioma", ar: "لغتك", cs: "Tvůj jazyk", it: "La tua lingua", ko: "당신의 언어", nl: "Jouw taal", zh: "你的语言" },
  Learning: { de: "Lernen", es: "Aprendiendo", fr: "Apprentissage", ja: "学習中", pt: "Aprendendo", ar: "تتعلّم", cs: "Učíš se", it: "Stai imparando", ko: "학습 언어", nl: "Leren", zh: "正在学习" },
  Level: { de: "Niveau", es: "Nivel", fr: "Niveau", ja: "レベル", pt: "Nível", ar: "المستوى", cs: "Úroveň", it: "Livello", ko: "레벨", nl: "Niveau", zh: "水平" },
  "Main goal": { de: "Hauptziel", es: "Objetivo principal", fr: "Objectif principal", ja: "主な目標", pt: "Objetivo principal", ar: "الهدف الرئيسي", cs: "Hlavní cíl", it: "Obiettivo principale", ko: "주요 목표", nl: "Hoofddoel", zh: "主要目标" },
  Focus: { de: "Schwerpunkt", es: "Enfoque", fr: "Focus", ja: "重点", pt: "Foco", ar: "التركيز", cs: "Zaměření", it: "Focus", ko: "집중", nl: "Focus", zh: "重点" },
  Travel: { de: "Reisen", es: "Viajes", fr: "Voyage", ja: "旅行", pt: "Viagem", ar: "السفر", cs: "Cestování", it: "Viaggi", ko: "여행", nl: "Reizen", zh: "旅行" },
  Work: { de: "Arbeit", es: "Trabajo", fr: "Travail", ja: "仕事", pt: "Trabalho", ar: "العمل", cs: "Práce", it: "Lavoro", ko: "업무", nl: "Werk", zh: "工作" },
  Conversation: { de: "Konversation", es: "Conversación", fr: "Conversation", ja: "会話", pt: "Conversação", ar: "المحادثة", cs: "Konverzace", it: "Conversazione", ko: "회화", nl: "Conversatie", zh: "对话" },
  "Movies & podcasts": { de: "Filme & Podcasts", es: "Películas y podcasts", fr: "Films et podcasts", ja: "映画・ポッドキャスト", pt: "Filmes e podcasts", ar: "أفلام وبودكاست", cs: "Filmy a podcasty", it: "Film e podcast", ko: "영화 & 팟캐스트", nl: "Films & podcasts", zh: "电影和播客" },
  "Intermediate is English-only.": {
    de: "Die Mittelstufe ist nur Englisch.",
    es: "Intermedio es solo inglés.",
    fr: "Le niveau intermédiaire est uniquement en anglais.",
    ja: "中級は英語のみです。",
    pt: "Intermediário é apenas inglês.",
    ar: "المستوى المتوسط مخصص للإنجليزية فقط.",
    cs: "Středně pokročilá úroveň je jen pro angličtinu.",
    it: "Il livello intermedio è solo per l'inglese.",
    ko: "중급은 영어 전용입니다.",
    nl: "Gemiddeld is alleen Engels.",
    zh: "中级仅限英语。",
  },
  "Used to prefill Discover curation.": {
    de: "Wird genutzt, um die Entdecken-Kuratierung vorzubelegen.",
    es: "Se usa para rellenar la curación de Descubrir.",
    fr: "Utilisé pour préremplir la curation de Découvrir.",
    ja: "発見のキュレーション入力に使われます。",
    pt: "Usado para preencher a curadoria do Descobrir.",
    ar: "يُستخدم لملء تنظيم الاكتشاف مسبقًا.",
    cs: "Použije se k předvyplnění výběru v Objevování.",
    it: "Usato per precompilare la selezione di Scopri.",
    ko: "탐색 큐레이션을 미리 채우는 데 사용됩니다.",
    nl: "Wordt gebruikt om Ontdekken vooraf in te vullen.",
    zh: "用于预填“发现”筛选。",
  },
  "phrasal verbs, meetings, travel situations...": {
    de: "Phrasal Verbs, Meetings, Reisesituationen...",
    es: "phrasal verbs, reuniones, situaciones de viaje...",
    fr: "verbes à particule, réunions, situations de voyage...",
    ja: "句動詞、会議、旅行場面...",
    pt: "phrasal verbs, reuniões, situações de viagem...",
    ar: "أفعال مركبة، اجتماعات، مواقف سفر...",
    cs: "frázová slovesa, schůzky, cestovní situace...",
    it: "phrasal verbs, riunioni, situazioni di viaggio...",
    ko: "구동사, 회의, 여행 상황...",
    nl: "phrasal verbs, vergaderingen, reissituaties...",
    zh: "短语动词、会议、旅行场景...",
  },
  "Weekly conversation goal": { de: "Wöchentliches Gesprächsziel", es: "Meta semanal de conversación", fr: "Objectif de conversation hebdomadaire", ja: "週ごとの会話目標", pt: "Meta semanal de conversação", ar: "هدف المحادثة الأسبوعي", cs: "Týdenní cíl konverzací", it: "Obiettivo settimanale di conversazione", ko: "주간 대화 목표", nl: "Wekelijks gespreksdoel", zh: "每周对话目标" },
  "Decrease weekly goal": { de: "Wochenziel verringern", es: "Reducir meta semanal", fr: "Réduire l'objectif hebdomadaire", ja: "週ごとの目標を減らす", pt: "Diminuir meta semanal", ar: "تقليل الهدف الأسبوعي", cs: "Snížit týdenní cíl", it: "Riduci obiettivo settimanale", ko: "주간 목표 줄이기", nl: "Weekdoel verlagen", zh: "减少每周目标" },
  "Increase weekly goal": { de: "Wochenziel erhöhen", es: "Aumentar meta semanal", fr: "Augmenter l'objectif hebdomadaire", ja: "週ごとの目標を増やす", pt: "Aumentar meta semanal", ar: "زيادة الهدف الأسبوعي", cs: "Zvýšit týdenní cíl", it: "Aumenta obiettivo settimanale", ko: "주간 목표 늘리기", nl: "Weekdoel verhogen", zh: "增加每周目标" },
  "{count} conversation per week": {
    de: "{count} Gespräch pro Woche",
    es: "{count} conversación por semana",
    fr: "{count} conversation par semaine",
    ja: "週 {count} 回の会話",
    pt: "{count} conversa por semana",
    ar: "{count} محادثة في الأسبوع",
    cs: "{count} konverzace týdně",
    it: "{count} conversazione a settimana",
    ko: "주 {count}회 대화",
    nl: "{count} gesprek per week",
    zh: "每周 {count} 次对话",
  },
  "{count} conversations per week": {
    de: "{count} Gespräche pro Woche",
    es: "{count} conversaciones por semana",
    fr: "{count} conversations par semaine",
    ja: "週 {count} 回の会話",
    pt: "{count} conversas por semana",
    ar: "{count} محادثات في الأسبوع",
    cs: "{count} konverzací týdně",
    it: "{count} conversazioni a settimana",
    ko: "주 {count}회 대화",
    nl: "{count} gesprekken per week",
    zh: "每周 {count} 次对话",
  },

  /* ── onboarding: method steps ───────────────────────────── */
  "Capture one source": { de: "Eine Quelle erfassen", es: "Captura una fuente", fr: "Capturez une source", ja: "ソースを1つ取り込む", pt: "Capture uma fonte", ar: "التقط مصدرًا واحدًا", cs: "Zachyť jeden zdroj", it: "Cattura una fonte", ko: "자료 하나 수집", nl: "Leg één bron vast", zh: "收集一个来源" },
  "Keep a small batch from real material instead of collecting everything.": {
    de: "Behalte eine kleine Auswahl aus echtem Material, statt alles zu sammeln.",
    es: "Quédate con un lote pequeño de material real en vez de guardarlo todo.",
    fr: "Gardez un petit lot de contenu réel au lieu de tout collectionner.",
    ja: "全部集めるのではなく、本物の素材から小さなまとまりを残します。",
    pt: "Guarde um lote pequeno de material real em vez de coletar tudo.",
    ar: "احتفظ بمجموعة صغيرة من مادة حقيقية بدل جمع كل شيء.",
    cs: "Nech si malou dávku ze skutečného materiálu místo sbírání všeho.",
    it: "Tieni un piccolo gruppo da materiale reale invece di raccogliere tutto.",
    ko: "전부 모으기보다 실제 자료에서 작은 묶음을 남기세요.",
    nl: "Bewaar een kleine set uit echt materiaal in plaats van alles te verzamelen.",
    zh: "从真实材料中保留一小批内容，而不是全部收集。",
  },
  "Review what is due": { de: "Fälliges wiederholen", es: "Repasa lo pendiente", fr: "Révisez ce qui est dû", ja: "期限の来たものを復習", pt: "Revise o que está pendente", ar: "راجع ما حان موعده", cs: "Zopakuj, co je na řadě", it: "Ripassa ciò che è previsto", ko: "복습할 것 확인", nl: "Herhaal wat klaarstaat", zh: "复习到期内容" },
  "Spaced repetition protects yesterday's work before adding more.": {
    de: "Spaced Repetition schützt die Arbeit von gestern, bevor Neues dazukommt.",
    es: "La repetición espaciada protege el trabajo de ayer antes de añadir más.",
    fr: "La répétition espacée protège le travail d'hier avant d'en ajouter.",
    ja: "間隔反復で昨日の学習を守ってから、新しい内容を足します。",
    pt: "A repetição espaçada protege o trabalho de ontem antes de adicionar mais.",
    ar: "يحمي التكرار المتباعد عمل الأمس قبل إضافة المزيد.",
    cs: "Rozložené opakování chrání včerejší práci, než přidáš další.",
    it: "La ripetizione dilazionata protegge il lavoro di ieri prima di aggiungere altro.",
    ko: "간격 반복은 새 내용을 더하기 전에 어제의 학습을 지켜 줍니다.",
    nl: "Gespreide herhaling beschermt het werk van gisteren voordat je meer toevoegt.",
    zh: "间隔重复先保护昨天的学习，再加入更多内容。",
  },
  "Produce language": { de: "Sprache produzieren", es: "Produce lenguaje", fr: "Produisez du langage", ja: "言語を使う", pt: "Produza linguagem", ar: "أنتج اللغة", cs: "Použij jazyk", it: "Produci lingua", ko: "언어로 표현", nl: "Produceer taal", zh: "输出语言" },
  "Conversation and corrections reveal what you cannot use yet.": {
    de: "Gespräche und Korrekturen zeigen, was du noch nicht verwenden kannst.",
    es: "La conversación y las correcciones revelan lo que todavía no puedes usar.",
    fr: "La conversation et les corrections révèlent ce que vous ne savez pas encore utiliser.",
    ja: "会話と添削で、まだ使えないものが見えてきます。",
    pt: "Conversas e correções revelam o que você ainda não consegue usar.",
    ar: "تكشف المحادثة والتصحيحات ما لا تستطيع استخدامه بعد.",
    cs: "Konverzace a opravy ukážou, co ještě neumíš používat.",
    it: "Conversazione e correzioni rivelano ciò che non sai ancora usare.",
    ko: "대화와 교정은 아직 사용할 수 없는 것을 드러냅니다.",
    nl: "Gesprekken en correcties laten zien wat je nog niet kunt gebruiken.",
    zh: "对话和纠正会暴露你还不能使用的内容。",
  },
  "Reinforce weak spots": { de: "Schwachstellen stärken", es: "Refuerza puntos débiles", fr: "Renforcez les points faibles", ja: "弱点を強化", pt: "Reforce pontos fracos", ar: "عزّز نقاط الضعف", cs: "Posil slabá místa", it: "Rinforza i punti deboli", ko: "약점 강화", nl: "Versterk zwakke plekken", zh: "强化薄弱点" },
  "The app turns repeated struggles into focused drills and fresh variants.": {
    de: "Die App verwandelt wiederholte Probleme in fokussierte Übungen und neue Varianten.",
    es: "La app convierte dificultades repetidas en ejercicios enfocados y variantes nuevas.",
    fr: "L'app transforme les difficultés répétées en exercices ciblés et nouvelles variantes.",
    ja: "アプリは繰り返すつまずきを集中ドリルと新しいバリエーションに変えます。",
    pt: "O app transforma dificuldades recorrentes em exercícios focados e novas variações.",
    ar: "يحوّل التطبيق الصعوبات المتكررة إلى تدريبات مركزة ونسخ جديدة.",
    cs: "Aplikace mění opakované potíže v cílená cvičení a nové varianty.",
    it: "L'app trasforma le difficoltà ricorrenti in esercizi mirati e nuove varianti.",
    ko: "앱은 반복되는 어려움을 집중 연습과 새로운 변형으로 바꿉니다.",
    nl: "De app zet terugkerende struikelpunten om in gerichte drills en nieuwe varianten.",
    zh: "应用会把反复困难转成专注练习和新变体。",
  },
  "Local providers keep content on your machine. Cloud providers are only used when you choose them.": {
    de: "Lokale Anbieter behalten Inhalte auf deinem Gerät. Cloud-Anbieter werden nur genutzt, wenn du sie auswählst.",
    es: "Los proveedores locales mantienen el contenido en tu máquina. Los proveedores en la nube solo se usan cuando los eliges.",
    fr: "Les fournisseurs locaux gardent le contenu sur votre machine. Les fournisseurs cloud ne sont utilisés que si vous les choisissez.",
    ja: "ローカルプロバイダーは内容をあなたのマシン上に保ちます。クラウドプロバイダーは選んだときだけ使われます。",
    pt: "Provedores locais mantêm o conteúdo na sua máquina. Provedores em nuvem só são usados quando você os escolhe.",
    ar: "يحافظ المزوّدون المحليون على المحتوى على جهازك. لا تُستخدم خدمات السحابة إلا عندما تختارها.",
    cs: "Lokální poskytovatelé nechávají obsah ve tvém počítači. Cloud se použije jen tehdy, když ho vybereš.",
    it: "I provider locali mantengono i contenuti sulla tua macchina. I provider cloud vengono usati solo quando li scegli.",
    ko: "로컬 제공자는 콘텐츠를 내 컴퓨터에 보관합니다. 클라우드 제공자는 선택했을 때만 사용됩니다.",
    nl: "Lokale providers houden inhoud op je machine. Cloudproviders worden alleen gebruikt wanneer jij ze kiest.",
    zh: "本地提供商会把内容保留在你的机器上。只有在你选择时才会使用云端提供商。",
  },

  /* ── onboarding: navigation buttons ─────────────────────── */
  "Start with Discover": { de: "Mit Entdecken beginnen", es: "Empezar con Descubrir", fr: "Commencer par Découvrir", ja: "発見から始める", pt: "Começar com Descobrir", ar: "ابدأ بالاكتشاف", cs: "Začít Objevováním", it: "Inizia con Scopri", ko: "탐색으로 시작", nl: "Beginnen met Ontdekken", zh: "从“发现”开始" },
  "Set up AI first →": { de: "Zuerst KI einrichten →", es: "Configurar la IA primero →", fr: "Configurer l'IA d'abord →", ja: "先にAIを設定 →", pt: "Configurar a IA primeiro →", ar: "إعداد الذكاء الاصطناعي أولاً →", cs: "Nejdřív nastavit AI →", it: "Configura prima l'IA →", ko: "먼저 AI 설정 →", nl: "Eerst AI instellen →", zh: "先设置 AI →" },

  /* ── AI plan modal and settings ─────────────────────────── */
  "What do you want to achieve?": { pt: "O que você quer alcançar?" },
  "Be specific — the more concrete your goal, the more focused your daily tasks will be.": { pt: "Seja específico: quanto mais concreta for sua meta, mais focadas serão suas tarefas diárias." },
  "Your goal": { pt: "Sua meta" },
  "{count} / 10 characters minimum": { pt: "{count} / mínimo de 10 caracteres" },
  "e.g. I want to watch Netflix shows in English without subtitles in 90 days": { pt: "ex.: Quero assistir séries da Netflix em inglês sem legendas em 90 dias" },
  "Current level": { pt: "Nível atual" },
  "Target level": { pt: "Nível-alvo" },
  "A model-backed AI provider is required to generate a plan.": { pt: "É necessário um provedor de IA com modelo para gerar um plano." },
  "Open Settings →": { pt: "Abrir configurações →" },
  "Open Settings to connect one.": { pt: "Abra as Configurações para conectar um provedor." },
  "Continue →": { pt: "Continuar →" },
  "How much time can you commit?": { pt: "Quanto tempo você pode dedicar?" },
  "Be honest — a consistent 15 min beats an ambitious 1 hour that doesn't happen.": { pt: "Seja honesto: 15 min consistentes vencem 1 hora ambiciosa que não acontece." },
  "Daily availability": { pt: "Disponibilidade diária" },
  "Plan length": { pt: "Duração do plano" },
  "30 days": { pt: "30 dias" },
  "60 days": { pt: "60 dias" },
  "90 days": { pt: "90 dias" },
  "180 days": { pt: "180 dias" },
  "10 min / day": { pt: "10 min / dia" },
  "20 min / day": { pt: "20 min / dia" },
  "30 min / day": { pt: "30 min / dia" },
  "45 min / day": { pt: "45 min / dia" },
  "1 hour / day": { pt: "1 hora / dia" },
  "The AI will create a {days}-day plan with {minutes} min of tasks per day, divided into phases that match your progress from {currentLevel} toward {targetLevel}.": { pt: "A IA criará um plano de {days} dias com {minutes} min de tarefas por dia, dividido em fases que acompanham seu progresso de {currentLevel} até {targetLevel}." },
  "Generated by {provider}.": { pt: "Gerado por {provider}." },
  "Generate my plan": { pt: "Gerar meu plano" },
  "Building your {days}-day plan…": { pt: "Criando seu plano de {days} dias…" },
  "{provider} is designing your phases and daily tasks.": { pt: "{provider} está desenhando suas fases e tarefas diárias." },
  "The AI": { pt: "A IA" },
  "Couldn't generate the plan. Try again.": { pt: "Não foi possível gerar o plano. Tente novamente." },
  "Choose how PhraseLoop uses AI.": { pt: "Escolha como o PhraseLoop usa IA." },
  "Back to PhraseLoop": { pt: "Voltar para o PhraseLoop" },
  "Manage your local PhraseLoop data.": { pt: "Gerencie seus dados locais do PhraseLoop." },
  "Settings are read-only in the browser. Configure providers with environment variables or open the desktop app.": { pt: "As configurações são somente leitura no navegador. Configure provedores com variáveis de ambiente ou abra o app desktop." },
  "Default AI provider": { pt: "Provedor de IA padrão" },
  "Default IA": { pt: "IA padrão" },
  "Ollama stays local. Cloud providers are never selected automatically.": { pt: "O Ollama fica local. Provedores em nuvem nunca são selecionados automaticamente." },
  "The demo and review work without IA setup. Custom content can use local or cloud IA.": {
    pt: "O demo e a revisão funcionam sem configurar IA. Conteúdo personalizado pode usar IA local ou em nuvem.",
  },
  "— unavailable": { pt: "— indisponível" },
  "Private and on-device. Recommended for the default PhraseLoop experience.": { pt: "Privado e no próprio dispositivo. Recomendado para a experiência padrão do PhraseLoop." },
  "Cloud AI from Anthropic. Your learning content is sent to Anthropic.": { pt: "IA em nuvem da Anthropic. Seu conteúdo de estudo é enviado para a Anthropic." },
  "Cloud AI from OpenAI. Your learning content is sent to OpenAI.": { pt: "IA em nuvem da OpenAI. Seu conteúdo de estudo é enviado para a OpenAI." },
  "Cloud AI routed through OpenRouter (default model openrouter/fusion). Your learning content is sent to OpenRouter.": { pt: "IA em nuvem roteada pelo OpenRouter (modelo padrão openrouter/fusion). Seu conteúdo de estudo é enviado para o OpenRouter." },
  Connected: { pt: "Conectado" },
  Offline: { pt: "Offline" },
  "Invalid key": { pt: "Chave inválida" },
  Testing: { pt: "Testando" },
  "Not configured": { pt: "Não configurado" },
  "API key": { pt: "Chave de API" },
  "Saved securely — enter a new key to replace it": { pt: "Salva com segurança — digite uma nova chave para substituir" },
  "Saved locally — enter a new key to replace it": { pt: "Salva localmente — digite uma nova chave para substituir" },
  "Paste your API key": { pt: "Cole sua chave de API" },
  "Save key": { pt: "Salvar chave" },
  "Test connection": { pt: "Testar conexão" },
  "Remove the saved {provider} credential?": { pt: "Remover a credencial salva de {provider}?" },
  "Remove key": { pt: "Remover chave" },
  "Server address": { pt: "Endereço do servidor" },
  Model: { pt: "Modelo" },
  Save: { pt: "Salvar" },
  "Refresh models": { pt: "Atualizar modelos" },
  "IA model": { pt: "Modelo da IA" },
  "Download a backup of practice phrases, reviews, and source material.": {
    pt: "Baixe um backup das frases para praticar, revisões e materiais de origem.",
  },
  "Text-to-speech, theme phrase lists, and export to Anki.": {
    pt: "Texto para fala, listas temáticas de frases e exportação para Anki.",
  },
  "Saved.": { pt: "Salvo." },
  "Something went wrong.": { pt: "Algo deu errado." },

  /* ── local data / backup (Settings) ─────────────────────── */
  "Local data": { pt: "Dados locais" },
  "Back up or restore practice phrases, reviews, and source material.": {
    pt: "Faça backup ou restaure frases, revisões e materiais de origem.",
  },
  "Download backup": { pt: "Baixar backup" },
  "Exporting...": { pt: "Exportando..." },
  "Validate restore": { pt: "Validar restauração" },
  "Backup downloaded.": { pt: "Backup baixado." },
  "Could not export local data.": { pt: "Não consegui exportar os dados locais." },
  "Backup validated. Review the dry run before restoring.": {
    pt: "Backup validado. Revise a simulação antes de restaurar.",
  },
  "Backup could not be validated.": { pt: "O backup não pôde ser validado." },
  "Could not read this backup file.": { pt: "Não consegui ler esse arquivo de backup." },
  "Restore this backup? Matching records will be updated, and nothing will be deleted.": {
    pt: "Restaurar este backup? Registros correspondentes serão atualizados e nada será apagado.",
  },
  "Backup could not be restored.": { pt: "O backup não pôde ser restaurado." },
  "{count} records restored.": { pt: "{count} registros restaurados." },
  "Could not restore local data.": { pt: "Não consegui restaurar os dados locais." },
  "Dry run passed: {count} records can be restored.": {
    pt: "Simulação aprovada: {count} registros podem ser restaurados.",
  },
  "Dry run failed. Fix the backup file before restoring.": {
    pt: "A simulação falhou. Corrija o arquivo de backup antes de restaurar.",
  },
  "Exported at {date}": { pt: "Exportado em {date}" },
  "Restore backup": { pt: "Restaurar backup" },
  "Restoring...": { pt: "Restaurando..." },
  "Restore adds or updates matching records by ID. It does not delete anything currently in PhraseLoop.": {
    pt: "A restauração adiciona ou atualiza registros pelo ID. Nada que já está no PhraseLoop é apagado.",
  },
  "Manage local data, advanced AI, and export tools.": {
    pt: "Gerencie dados locais, IA avançada e ferramentas de exportação.",
  },

  /* ── data transparency (Settings) ───────────────────────── */
  "Where your data lives": { pt: "Onde seus dados ficam" },
  "Everything stays on this computer. Practice phrases, reviews, mistakes, and progress live in the app's local database — nothing is sent anywhere unless you connect a cloud AI.": {
    pt: "Tudo fica neste computador. Frases, revisões, erros e progresso ficam no banco de dados local do app — nada é enviado para lugar nenhum, a menos que você conecte uma IA em nuvem.",
  },
  "Imported audio and downloaded voice models are kept in this folder:": {
    pt: "Áudios importados e modelos de voz baixados ficam nesta pasta:",
  },
  "Deleting removes everything above from this computer. Downloaded voice models stay — they are not personal data.": {
    pt: "Apagar remove tudo acima deste computador. Os modelos de voz baixados permanecem — eles não são dados pessoais.",
  },
  "Delete all local data": { pt: "Apagar todos os dados locais" },
  "Deleting...": { pt: "Apagando..." },
  "Delete ALL local data? Practice phrases, reviews, mistakes, progress, and preferences will be permanently removed from this computer. Download a backup first if you might want them back.": {
    pt: "Apagar TODOS os dados locais? Frases, revisões, erros, progresso e preferências serão removidos deste computador para sempre. Baixe um backup antes se quiser poder voltar atrás.",
  },
  "Could not delete all local data. Try again.": {
    pt: "Não consegui apagar todos os dados. Tente de novo.",
  },

  /* ── try demo (Discover) ────────────────────────────────── */
  Today: { pt: "Hoje" },
  Phrases: { pt: "Frases" },
  Review: { pt: "Revisar" },
  Mistakes: { pt: "Erros" },
  or: { pt: "ou" },
  "Try an example": { pt: "Testar com um exemplo" },
  "Start first lesson": { pt: "Começar primeira lição" },
  "Example content — tap to listen, then uncheck anything you don't want.": {
    pt: "Conteúdo de exemplo — toque para ouvir e desmarque o que não quiser.",
  },
  "This is sample content, not your own captures.": {
    pt: "Este é um conteúdo de exemplo, não as suas próprias capturas.",
  },
  "Clear example": { pt: "Limpar exemplo" },
  "Turn useful phrases into daily practice": {
    pt: "Transforme frases úteis em prática diária",
  },
  "Bring one video, article, or PDF when you want practice from your own material.": {
    pt: "Traga um vídeo, artigo ou PDF quando quiser praticar com o seu próprio material.",
  },
  "Use your own content": { pt: "Usar seu próprio conteúdo" },
  "YouTube, article, and PDF import for the source you already care about.": {
    pt: "Importe YouTube, artigo ou PDF da fonte que você já quer entender.",
  },
  "English level": { pt: "Nível de inglês" },
  "Advanced options": { pt: "Opções avançadas" },
  "Optional focus and AI choice for your own material.": {
    pt: "Foco opcional e escolha de IA para material próprio.",
  },
  optional: { pt: "opcional" },
  "e.g., phrasal verbs, work vocabulary…": { pt: "ex.: phrasal verbs, vocabulário de trabalho…" },
  "Connect an AI in Settings to pick phrases automatically. For now, tap the phrases you want to keep.": {
    pt: "Conecte uma IA em Configurações para escolher frases automaticamente. Por enquanto, toque nas frases que quer manter.",
  },
  "PDF file": { pt: "Arquivo PDF" },
  "Article link": { pt: "Link do artigo" },
  "YouTube link": { pt: "Link do YouTube" },
  "Discard the current Discover results?": {
    pt: "Descartar os resultados atuais do Descobrir?",
  },
  "Selecting…": { pt: "Selecionando…" },
  "Transcribing… {percent}%": { pt: "Transcrevendo… {percent}%" },
  "Downloading audio…": { pt: "Baixando áudio…" },
  "Extracting…": { pt: "Extraindo…" },
  "Find phrases to learn": { pt: "Buscar frases para aprender" },
  "You can import a source and save hand-picked phrases now — no setup needed. To pick phrases automatically and add translations, connect an AI": {
    pt: "Você pode importar uma fonte e salvar frases escolhidas à mão agora — sem configuração. Para escolher frases automaticamente e adicionar traduções, conecte uma IA",
  },
  "Say what it means, then try using it in your own sentence.": {
    pt: "Diga o que significa e depois tente usar em uma frase sua.",
  },
  "1 phrase saved for review. Find it in Study.": {
    pt: "1 frase salva para revisão. Encontre-a em Estudar.",
  },
  "{count} phrases saved for review. Find them in Study.": {
    pt: "{count} frases salvas para revisão. Encontre-as em Estudar.",
  },
  "Could not save these phrases.": { pt: "Não consegui salvar essas frases." },
  "The local voice model (Kokoro, about 349 MB) needs to be downloaded once before audio can be generated.": {
    pt: "O modelo de voz local (Kokoro, cerca de 349 MB) precisa ser baixado uma vez antes de gerar áudio.",
  },
  "Downloading voice model… {percent}%": { pt: "Baixando o modelo de voz… {percent}%" },
  "Preparing voice model download…": { pt: "Preparando o download do modelo de voz…" },
  "Download voice model": { pt: "Baixar modelo de voz" },
  "in Settings →": { pt: "em Configurações →" },
  "in Settings.": { pt: "em Configurações." },
  "Preparing audio discovery for the first time. This can take a minute.": {
    pt: "Preparando a descoberta por áudio pela primeira vez. Pode levar um minuto.",
  },
  "1 passage pre-selected for {level}.": { pt: "1 trecho pré-selecionado para {level}." },
  "{count} passages pre-selected for {level}.": {
    pt: "{count} trechos pré-selecionados para {level}.",
  },
  "No passages pre-selected for {level}.": { pt: "Nenhum trecho pré-selecionado para {level}." },
  "Automatic selection skipped: {message}": { pt: "Seleção automática pulada: {message}" },
  "Automatic selection skipped.": { pt: "Seleção automática pulada." },

  /* ── Hoje home ──────────────────────────────────────────── */
  "Loading your day…": { pt: "Carregando o seu dia…" },
  "Now do this": { pt: "Agora faça isto" },
  "Start now": { pt: "Começar agora" },
  "From your learning plan for today.": { pt: "Do seu plano de estudo de hoje." },
  "All done for today 🎉": { pt: "Tudo pronto por hoje 🎉" },
  "Great work. Come back tomorrow, or get a head start now.": {
    pt: "Bom trabalho. Volte amanhã ou adiante uma parte agora.",
  },
  "Review anyway": { pt: "Revisar mesmo assim" },
  "Find new phrases": { pt: "Buscar novas frases" },
  "{count} cards to review": { pt: "{count} cartões para revisar" },
  "{count} practice phrases due": { pt: "{count} frases para praticar esperando revisão" },
  "{count} cards for today — 1 came from your mistake yesterday": {
    pt: "{count} frases para hoje — 1 veio do seu erro de ontem",
  },
  "{count} cards for today — {mistakes} came from your mistakes yesterday": {
    pt: "{count} frases para hoje — {mistakes} vieram dos seus erros de ontem",
  },
  "{count} cards for today — 1 came from your mistake": {
    pt: "{count} frases para hoje — 1 veio do seu erro",
  },
  "{count} cards for today — {mistakes} came from your mistakes": {
    pt: "{count} frases para hoje — {mistakes} vieram dos seus erros",
  },
  "Review while yesterday is still fresh.": {
    pt: "Revise enquanto o que aconteceu ontem ainda está fresco.",
  },
  "Reviewing your own mistakes is what makes them stick.": {
    pt: "Revisar os seus próprios erros é o que faz eles fixarem.",
  },
  "Start today's review": { pt: "Revisar agora" },
  "Review these before adding more, so nothing piles up.": {
    pt: "Revise estes antes de adicionar mais, para nada acumular.",
  },
  "Study now": { pt: "Estudar agora" },
  "Review now": { pt: "Revisar agora" },
  "You're caught up": { pt: "Você está em dia" },
  "Nothing to review right now": { pt: "Nada para revisar agora" },
  "Add a new source to find more phrases, or come back when cards are due.": {
    pt: "Adicione uma nova fonte para achar mais frases, ou volte quando houver cartões para revisar.",
  },
  "Start here": { pt: "Comece por aqui" },
  "Learn your first phrases in 2 minutes": { pt: "Aprenda suas primeiras frases em 2 minutos" },
  "Turn useful English into review in 2 minutes": {
    pt: "Transforme inglês útil em revisão em 2 minutos",
  },
  "Turn real English into review cards in 2 minutes": {
    pt: "Transforme inglês real em cartões de revisão em 2 minutos",
  },
  "Turn real English into tomorrow's practice": {
    pt: "Transforme inglês real no treino de amanhã",
  },
  "Start with one short lesson": {
    pt: "Comece com uma lição curta",
  },
  "Listen, save one useful phrase, and use it in a sentence of your own.": {
    pt: "Ouça, salve uma frase útil e use-a em uma frase sua.",
  },
  "Hear real phrases, save the useful ones, then review them — no setup needed.": {
    pt: "Ouça frases reais, salve as úteis e revise — sem configurar nada.",
  },
  "Hear native audio, save a few phrases, and review right away — no setup needed.": {
    pt: "Ouça áudio nativo, salve algumas frases e revise na hora — sem configurar nada.",
  },
  "Practice phrases from a native clip and your own mistake — no setup needed.": {
    pt: "Pratique frases de um clipe nativo e de um erro seu — sem configurar nada.",
  },
  "See real phrases, keep the useful ones, and study them — no setup needed.": {
    pt: "Veja frases reais, guarde as úteis e estude — sem configurar nada.",
  },
  "Import your own": { pt: "Importar o seu conteúdo" },
  "{lesson} ({level})": { pt: "{lesson} ({level})" },
  "Start with graded phrases, native audio, and Study cards — no setup needed.": {
    pt: "Comece com frases graduadas, áudio nativo e cartões no Estudar — sem configurar nada.",
  },
  "Continue the guided path, or come back when cards are due.": {
    pt: "Continue a trilha guiada ou volte quando houver cartões para revisar.",
  },
  "Tomorrow you review these phrases. Today you can practice one more.": {
    pt: "Amanhã você revisa essas frases. Hoje ainda dá para praticar mais uma.",
  },
  "Start lesson": { pt: "Começar lição" },
  "Practice a phrase": { pt: "Praticar uma frase" },
  "Correct mistakes": { pt: "Corrigir erros" },
  "Save your mistakes for study": { pt: "Salve seus erros para estudar" },
  "Turn recent corrections into phrases you can review tomorrow.": {
    pt: "Transforme correções recentes em frases para revisar amanhã.",
  },
  "Save to study": { pt: "Salvar para estudar" },
  "New section unlocked: {section}": { pt: "Nova seção desbloqueada: {section}" },
  "day streak": { pt: "dias seguidos" },
  "to review": { pt: "para revisar" },
  "cards saved": { pt: "cartões salvos" },
  "practice phrases": { pt: "frases para praticar" },
  "First task started with": { pt: "Início da primeira tarefa" },
  "Own material": { pt: "Material próprio" },
  "Bundled lesson": { pt: "Lição incluída" },
  "Local activity data is unavailable in this build.": {
    pt: "Os dados locais de atividade não estão disponíveis nesta build.",
  },
  "Time to saved phrase": { pt: "Tempo até salvar frase" },
  "Time to first review": { pt: "Tempo até primeira revisão" },
  "Time to complete first task": { pt: "Tempo para concluir a primeira tarefa" },
  "Where the first task stopped": { pt: "Onde a primeira tarefa parou" },
  "Under 2m": { pt: "Menos de 2min" },
  "Over 2m": { pt: "Mais de 2min" },
  Incomplete: { pt: "Incompleto" },
  Complete: { pt: "Completo" },
  Open: { pt: "Aberto" },
  "Not yet": { pt: "Ainda não" },
  Returned: { pt: "Retornou" },
  "No return yet": { pt: "Sem retorno ainda" },
  "D+1 return": { pt: "Retorno D+1" },
  "D+7 return": { pt: "Retorno D+7" },
  Clip: { pt: "Clipe" },
  "Save phrase": { pt: "Salvar frase" },
  Mistake: { pt: "Erro" },
  Correction: { pt: "Correção" },
  "Own material import": { pt: "Importação de material próprio" },
  Completed: { pt: "Concluído" },
  Attempted: { pt: "Tentado" },
  "Not attempted": { pt: "Não tentado" },
  "Learner profile": { pt: "Perfil de aprendizado" },
  "Adjust your English level as you progress. Lessons and corrections follow it.": {
    pt: "Ajuste seu nível de inglês conforme você progride. Lições e correções acompanham o nível.",
  },
  "From B1 the interface switches to English.": {
    pt: "A partir do B1, a interface muda para inglês.",
  },
  "Active days since first session: {days}": {
    pt: "Dias ativos desde a primeira sessão: {days}",
  },

  /* ── bundled lessons ───────────────────────────────────── */
  "Listen, keep the phrases you want, then save them to Study. No AI setup needed.": {
    pt: "Ouça, mantenha as frases que quiser e salve no Estudar. Sem configurar IA.",
  },
  "Listen, save the phrases you want, then review them. No AI setup needed.": {
    pt: "Ouça, salve as frases que quiser e revise. Sem configurar IA.",
  },
  "Listen to the audio, save the phrases you want, then review them. You can start now.": {
    pt: "Ouça o áudio, salve as frases que quiser e revise. Você pode começar agora.",
  },
  "Bundled lesson — all phrases are selected by default.": {
    pt: "Lição incluída — todas as frases já vêm selecionadas.",
  },
  "All phrases are selected by default.": {
    pt: "Todas as frases já vêm selecionadas.",
  },
  "Save and study": { pt: "Salvar e estudar" },
  "Saving…": { pt: "Salvando…" },
  "Saving lesson cards…": { pt: "Salvando cartões da lição…" },
  "Saving practice phrases…": { pt: "Salvando frases para praticar…" },
  "Lesson already saved. Study is ready.": { pt: "A lição já foi salva. O Estudar está pronto." },
  "{count} cards saved. Study is ready.": { pt: "{count} cartões salvos. O Estudar está pronto." },
  "Lesson already saved. Now write one sentence of your own below.": {
    pt: "A lição já foi salva. Agora escreva uma frase sua aqui embaixo.",
  },
  "{count} practice phrases saved. Now write one sentence of your own below.": {
    pt: "{count} frases para praticar salvas. Agora escreva uma frase sua aqui embaixo.",
  },
  "You saved {count} phrases to review: {phrases} from real English and 1 from your own mistake.": {
    pt: "Você salvou {count} frases para revisar: {phrases} de inglês real e 1 do seu próprio erro.",
  },
  "You saved {count} phrases to review: {phrases} from real English and 1 you wrote yourself.": {
    pt: "Você salvou {count} frases para revisar: {phrases} de inglês real e 1 que você mesmo escreveu.",
  },
  "Could not save this lesson.": { pt: "Não foi possível salvar esta lição." },
  "Now try a video of your own": { pt: "Agora teste com um vídeo seu" },
  "Use a short video to turn real phrases into review with the original audio.": {
    pt: "Use um vídeo curto para transformar frases reais em revisão com o áudio original.",
  },
  "Try a suggested video": { pt: "Testar com vídeo sugerido" },
  "Practice pronunciation": { pt: "Praticar pronúncia" },
  "Repeat the lesson phrases and get local feedback.": {
    pt: "Repita as frases da lição e receba feedback local.",
  },
  "One step left": { pt: "Falta uma etapa" },
  "Review a saved phrase to finish this lesson": {
    pt: "Revise uma frase salva para concluir esta lição",
  },
  "After the review, your own sources and extra practice will be ready in the app.": {
    pt: "Depois da revisão, suas próprias fontes e as práticas extras estarão disponíveis no app.",
  },
  "Review now and finish": { pt: "Revisar agora e concluir" },
  "Learn a small set, listen without the transcript, then use one phrase yourself.": {
    pt: "Aprenda um conjunto pequeno, ouça sem a transcrição e depois use uma frase você mesmo.",
  },
  "1 · Learn": { pt: "1 · Aprender" },
  "Learn three useful phrases": { pt: "Aprenda três frases úteis" },
  "Learn five useful phrases": { pt: "Aprenda cinco frases úteis" },
  "Study the meaning, pattern, and situation. You will hear this language next.": {
    pt: "Estude o significado, o padrão e a situação. Você vai ouvir essa linguagem em seguida.",
  },
  "Pattern: {pattern}": { pt: "Padrão: {pattern}" },
  "Continue to listening": { pt: "Continuar para a escuta" },
  "2 · Listen": { pt: "2 · Ouvir" },
  "Listen before reading": { pt: "Ouça antes de ler" },
  "First catch the situation and one phrase. You do not need to understand every word.": {
    pt: "Primeiro, identifique a situação e uma frase. Você não precisa entender cada palavra.",
  },
  "First catch the situation and two phrases. You do not need to understand every word.": {
    pt: "Primeiro, identifique a situação e duas frases. Você não precisa entender cada palavra.",
  },
  "Audio-only check": { pt: "Verificação apenas com áudio" },
  "Audio-only clip {count}": { pt: "Áudio {count} sem transcrição" },
  "{speaker} · audio-only clip {count}": { pt: "{speaker} · áudio {count} sem transcrição" },
  "Play clip without transcript": { pt: "Tocar áudio sem transcrição" },
  "Play clip {count} without transcript": { pt: "Tocar áudio {count} sem transcrição" },
  "Listen at least once before answering.": { pt: "Ouça pelo menos uma vez antes de responder." },
  "Listened {count} time(s). Replay whenever you need.": {
    pt: "Você ouviu {count} vez(es). Repita quando precisar.",
  },
  "What is the main situation?": { pt: "Qual é a situação principal?" },
  "Which meaning matches the phrase?": { pt: "Qual significado corresponde à frase?" },
  "Which meaning matches clip {count}?": { pt: "Qual significado corresponde ao áudio {count}?" },
  "Check what I heard": { pt: "Verificar o que ouvi" },
  "Not yet. Replay the clip and focus on the familiar words; there is no penalty for another try.": {
    pt: "Ainda não. Ouça novamente e foque nas palavras conhecidas; não há penalidade por tentar de novo.",
  },
  "You caught the main idea and the phrase meaning.": {
    pt: "Você identificou a ideia principal e o significado da frase.",
  },
  "You caught the main idea and both phrase meanings.": {
    pt: "Você identificou a ideia principal e o significado das duas frases.",
  },
  "You caught the main idea and the important details.": {
    pt: "Você identificou a ideia principal e os detalhes importantes.",
  },
  "Reveal transcript and choose phrases": { pt: "Mostrar transcrição e escolher frases" },
  "Now compare what you heard with the transcript and notice the phrases worth keeping.": {
    pt: "Agora compare o que ouviu com a transcrição e observe quais frases vale a pena guardar.",
  },
  "Listening transcript": { pt: "Transcrição da escuta" },
  "Compare the dialogue with what you understood before reading.": {
    pt: "Compare o diálogo com o que você entendeu antes de ler.",
  },

  /* ── first-loop mistake step ───────────────────────────── */
  "Your turn": { pt: "Sua vez" },
  "Write one sentence in English": { pt: "Escreva uma frase em inglês" },
  'Use "{phrase}" in your own sentence. You will practice the corrected version tomorrow.': {
    pt: 'Use "{phrase}" em uma frase sua. Amanhã você vai praticar a versão corrigida.',
  },
  'Use "{phrase}" or its reusable pattern, and add one detail of your own.': {
    pt: 'Use "{phrase}" ou o padrão reutilizável dela e acrescente um detalhe seu.',
  },
  "Write your sentence here…": { pt: "Escreva sua frase aqui…" },
  "Check my sentence": { pt: "Corrigir minha frase" },
  "Checking your sentence…": { pt: "Verificando sua frase…" },
  "Check again": { pt: "Corrigir de novo" },
  "Nothing to fix — nice work.": { pt: "Nada para corrigir — mandou bem." },
  "You wrote": { pt: "Você escreveu" },
  "Corrected version": { pt: "Versão corrigida" },
  'Tip: try using "{phrase}" in your sentence.': {
    pt: 'Dica: tente usar "{phrase}" na sua frase.',
  },
  "Save the correction for tomorrow": { pt: "Salvar a correção para amanhã" },
  "Save your sentence for tomorrow": { pt: "Salvar sua frase para amanhã" },
  "Could not save your sentence.": { pt: "Não foi possível salvar sua frase." },
  "Check the spelling of the lesson phrase.": { pt: "Confira a escrita da frase da lição." },
  'In English, "I" is always capitalized.': { pt: 'Em inglês, "I" é sempre maiúsculo.' },
  "Start the sentence with a capital letter.": { pt: "Comece a frase com letra maiúscula." },
  "End the sentence with punctuation (like . or ?).": {
    pt: "Termine a frase com pontuação (como . ou ?).",
  },
  "Use the lesson phrase or its reusable pattern.": {
    pt: "Use a frase da lição ou o padrão reutilizável dela.",
  },
  "Add one detail of your own instead of repeating only the model phrase.": {
    pt: "Acrescente um detalhe seu em vez de repetir apenas a frase modelo.",
  },
  "Apply the feedback": { pt: "Aplique o feedback" },
  "Write the sentence again": { pt: "Escreva a frase novamente" },
  "Use the feedback above in a new attempt. Saving unlocks only after the second attempt is clear.": {
    pt: "Use o feedback acima em uma nova tentativa. Você só poderá salvar quando a segunda tentativa estiver clara.",
  },
  "Your first answer was clear. Produce it once more from memory before saving it.": {
    pt: "Sua primeira resposta estava clara. Produza-a mais uma vez de memória antes de salvar.",
  },
  "Write your second attempt here…": { pt: "Escreva sua segunda tentativa aqui…" },
  "Second attempt": { pt: "Segunda tentativa" },
  "Check second attempt": { pt: "Verificar segunda tentativa" },
  "Checking second attempt…": { pt: "Verificando a segunda tentativa…" },
  "Check second attempt again": { pt: "Verificar segunda tentativa de novo" },
  "Your second attempt applies the feedback and is ready for review.": {
    pt: "Sua segunda tentativa aplica o feedback e está pronta para revisão.",
  },
  "Save the improved sentence for tomorrow": { pt: "Salvar a frase melhorada para amanhã" },
  "Your message is clear and uses the lesson language.": {
    pt: "Sua mensagem está clara e usa a linguagem da lição.",
  },
  "Focus first: {category}": { pt: "Foque primeiro em: {category}" },
  "Message clarity": { pt: "Clareza da mensagem" },
  "Lesson language": { pt: "Linguagem da lição" },
  "Writing mechanics": { pt: "Mecânica da escrita" },
  "Lesson 1 — Greetings": { pt: "Lição 1 — Cumprimentos" },
  "Lesson 2 — Names": { pt: "Lição 2 — Nomes" },
  "Lesson 3 — Countries and Cities": { pt: "Lição 3 — Países e cidades" },
  "Lesson 4 — Be": { pt: "Lição 4 — Verbo be" },
  "Lesson 5 — Jobs": { pt: "Lição 5 — Trabalhos" },
  "Lesson 6 — Family": { pt: "Lição 6 — Família" },
  "Lesson 7 — Numbers and Age": { pt: "Lição 7 — Números e idade" },
  "Lesson 8 — Daily Routine": { pt: "Lição 8 — Rotina diária" },
  "Lesson 9 — Food": { pt: "Lição 9 — Comida" },
  "Lesson 10 — Directions": { pt: "Lição 10 — Direções" },
  "Lesson 19 — Nuance and Stance": { pt: "Lição 19 — Nuance e posicionamento" },
  "Lesson 20 — Register and Professional Tone": { pt: "Lição 20 — Registro e tom profissional" },
  "Lesson 21 — Precision and Emphasis": { pt: "Lição 21 — Precisão e ênfase" },
  "Lesson 22 — Rhetorical Control": { pt: "Lição 22 — Controle retórico" },
  "Example — Everyday Phrases": { pt: "Exemplo — Frases do dia a dia" },
  "Extra A1 — Weather and Clothes": { pt: "Extra A1 — Clima e roupas" },
  "Extra A2 — Home and Neighborhood": { pt: "Extra A2 — Casa e bairro" },
  "Extra B1 — Learning Habits": { pt: "Extra B1 — Hábitos de estudo" },
  "Extra B2 — Decisions and Trade-offs": { pt: "Extra B2 — Decisões e concessões" },
  "Extra C1 — Leading Meetings": { pt: "Extra C1 — Conduzindo reuniões" },
  "Extra C2 — Critical Synthesis": { pt: "Extra C2 — Síntese crítica" },
  "Weather, clothes, and simple daily choices": { pt: "Clima, roupas e escolhas simples do dia a dia" },
  "Describing a home and the area around it": { pt: "Descrevendo uma casa e a área ao redor" },
  "Explaining study routines and learning strategies": { pt: "Explicando rotinas e estratégias de estudo" },
  "Comparing options and explaining difficult decisions": { pt: "Comparando opções e explicando decisões difíceis" },
  "Guiding discussion, disagreement, and decisions at work": { pt: "Conduzindo discussões, discordâncias e decisões no trabalho" },
  "Combining competing evidence into a precise conclusion": { pt: "Combinando evidências concorrentes em uma conclusão precisa" },
  "Greetings and polite first moves": { pt: "Cumprimentos e primeiras interações educadas" },
  "Names and simple introductions": { pt: "Nomes e apresentações simples" },
  "Places, origin, and location": { pt: "Lugares, origem e localização" },
  "I am, you are, it is": { pt: "I am, you are, it is" },
  "Work, study, and simple roles": { pt: "Trabalho, estudo e papéis simples" },
  "Family and people close to you": { pt: "Família e pessoas próximas" },
  "Age, phone numbers, and simple quantities": { pt: "Idade, telefones e quantidades simples" },
  "Simple present for everyday actions": { pt: "Presente simples para ações do dia a dia" },
  "Ordering food and saying what you want": { pt: "Pedir comida e dizer o que você quer" },
  "Finding places in town": { pt: "Encontrar lugares na cidade" },
  "Expressing precise attitudes and reservations": { pt: "Expressar atitudes precisas e ressalvas" },
  "Adjusting tone in professional contexts": { pt: "Ajustar o tom em contextos profissionais" },
  "Making exact claims with controlled emphasis": { pt: "Fazer afirmações exatas com ênfase controlada" },
  "Controlling argument flow and emphasis": { pt: "Controlar o fluxo do argumento e a ênfase" },
  "Bundled B1 sample from the demo": { pt: "Amostra B1 incluída do demo" },

  /* ── Wave 1 lesson material (100-lesson roadmap backlog) ─── */
  /* a2-cooking */
  "Lesson 30 — In the Kitchen": { pt: "Lição 30 — Na cozinha" },
  "Ingredients, quantities, and following a recipe": { pt: "Ingredientes, quantidades e como seguir uma receita" },
  "Follow and give simple cooking instructions using quantities.": { pt: "Seguir e dar instruções simples de cozinha usando quantidades." },
  "Linking a final consonant to 'it': cut it, put it, turn it.": { pt: "Ligar a consoante final a 'it': cut it, put it, turn it." },
  "Describe a simple dish you cook at home. Say what you need and give two instructions.": { pt: "Descreva um prato simples que você faz em casa. Diga do que você precisa e dê duas instruções." },
  "Use one quantity word (a little, enough, how many) and start one instruction with a verb.": { pt: "Use uma palavra de quantidade (a little, enough, how many) e comece uma instrução com um verbo." },
  "What are the two speakers doing?": { pt: "O que as duas pessoas estão fazendo?" },
  "Cooking a meal together": { pt: "Cozinhando uma refeição juntos" },
  "Ordering food in a restaurant": { pt: "Pedindo comida em um restaurante" },
  "Shopping at the supermarket": { pt: "Fazendo compras no supermercado" },
  "What does Bruno ask Ana to do first?": { pt: "O que Bruno pede que Ana faça primeiro?" },
  "Cut the onions": { pt: "Cortar as cebolas" },
  "Wash the rice": { pt: "Lavar o arroz" },
  "Turn off the oven": { pt: "Desligar o forno" },
  "Which ingredient is missing?": { pt: "Qual ingrediente está faltando?" },
  "Flour": { pt: "Farinha" },
  "Salt": { pt: "Sal" },
  "Oil": { pt: "Óleo" },
  /* a2-hobbies */
  "Lesson 31 — Free Time": { pt: "Lição 31 — Tempo livre" },
  "Hobbies and how often you do them": { pt: "Hobbies e com que frequência você os pratica" },
  "Say what you do in your free time and how often you do it.": { pt: "Dizer o que você faz no tempo livre e com que frequência." },
  "Stress on the first syllable: USUally, NORmally, HARDly.": { pt: "Acento na primeira sílaba: USUally, NORmally, HARDly." },
  "Talk about one thing you do in your free time. Say how often you do it and why you like it.": { pt: "Fale sobre algo que você faz no tempo livre. Diga com que frequência e por que gosta." },
  "Add one frequency expression (usually, twice a week, hardly ever) and one reason.": { pt: "Acrescente uma expressão de frequência (usually, twice a week, hardly ever) e um motivo." },
  "What are Carla and Diego talking about?": { pt: "Sobre o que Carla e Diego estão conversando?" },
  "Their free-time activities": { pt: "As atividades de tempo livre deles" },
  "Their work schedules": { pt: "Os horários de trabalho deles" },
  "A trip they are planning": { pt: "Uma viagem que estão planejando" },
  "How often does Diego go to the gym?": { pt: "Com que frequência Diego vai à academia?" },
  "Twice a week": { pt: "Duas vezes por semana" },
  "Every day": { pt: "Todos os dias" },
  "Once a month": { pt: "Uma vez por mês" },
  "Why does Carla like her hobby?": { pt: "Por que Carla gosta do hobby dela?" },
  "It helps her relax": { pt: "Isso a ajuda a relaxar" },
  "It earns her money": { pt: "Isso lhe dá dinheiro" },
  "Her friends do it too": { pt: "Os amigos dela também fazem isso" },
  /* a2-hotel */
  "Lesson 32 — At the Hotel": { pt: "Lição 32 — No hotel" },
  "Checking in, room needs, and small complaints": { pt: "Check-in, necessidades do quarto e pequenas reclamações" },
  "Check into a hotel, ask for what your room needs, and report a small problem.": { pt: "Fazer check-in em um hotel, pedir o que o quarto precisa e relatar um problema simples." },
  "Polite rising intonation on requests: Could I have a towel?": { pt: "Entonação ascendente e educada nos pedidos: Could I have a towel?" },
  "You have just arrived at a hotel. Check in, ask one question about the room, and report one problem.": { pt: "Você acabou de chegar a um hotel. Faça o check-in, faça uma pergunta sobre o quarto e relate um problema." },
  "Use one polite request (Could I..., Could you...) and describe the problem with isn't working or there's no.": { pt: "Use um pedido educado (Could I..., Could you...) e descreva o problema com isn't working ou there's no." },
  "Where is this conversation happening?": { pt: "Onde essa conversa está acontecendo?" },
  "At a hotel reception desk": { pt: "Na recepção de um hotel" },
  "At an airport check-in desk": { pt: "No balcão de check-in do aeroporto" },
  "In a restaurant": { pt: "Em um restaurante" },
  "What does the guest ask about first?": { pt: "Sobre o que o hóspede pergunta primeiro?" },
  "Whether breakfast is included": { pt: "Se o café da manhã está incluso" },
  "The price of the room": { pt: "O preço do quarto" },
  "The way to the station": { pt: "O caminho até a estação" },
  "What problem does the guest report?": { pt: "Qual problema o hóspede relata?" },
  "The air conditioning is broken": { pt: "O ar-condicionado está quebrado" },
  "The room is too small": { pt: "O quarto é pequeno demais" },
  "The key does not work": { pt: "A chave não funciona" },
  /* a2-airport */
  "Lesson 33 — At the Airport": { pt: "Lição 33 — No aeroporto" },
  "Check-in, security, gates, and delays": { pt: "Check-in, segurança, portões e atrasos" },
  "Get through check-in and security, and understand gate and delay announcements.": { pt: "Passar pelo check-in e pela segurança e entender avisos de portão e de atraso." },
  "Numbers and letters said clearly: gate B12, flight LA8067.": { pt: "Números e letras ditos com clareza: gate B12, flight LA8067." },
  "You are checking in for a flight. Ask two questions and say what luggage you have.": { pt: "Você está fazendo check-in para um voo. Faça duas perguntas e diga que bagagem você tem." },
  "Use I'd like for your request and one question word (which, how long, where).": { pt: "Use I'd like no seu pedido e uma palavra interrogativa (which, how long, where)." },
  "What is the traveller doing?": { pt: "O que o viajante está fazendo?" },
  "Checking in for a flight": { pt: "Fazendo check-in para um voo" },
  "Buying a plane ticket": { pt: "Comprando uma passagem de avião" },
  "Collecting lost luggage": { pt: "Buscando uma bagagem perdida" },
  "What does the traveller ask for?": { pt: "O que o viajante pede?" },
  "A window seat": { pt: "Um assento na janela" },
  "An extra bag": { pt: "Uma mala extra" },
  "A refund": { pt: "Um reembolso" },
  "What does the agent say at the end?": { pt: "O que o atendente diz no final?" },
  "The flight is delayed by an hour": { pt: "O voo está atrasado em uma hora" },
  "The gate has changed": { pt: "O portão mudou" },
  "The flight is full": { pt: "O voo está lotado" },
  /* a2-appointments */
  "Lesson 34 — Appointments": { pt: "Lição 34 — Compromissos" },
  "Booking, changing, and cancelling an appointment": { pt: "Marcar, remarcar e cancelar um compromisso" },
  "Book an appointment, then move or cancel it politely.": { pt: "Marcar um horário e depois remarcá-lo ou cancelá-lo com educação." },
  "Weak 'to' in phrases like need to and want to.": { pt: "O 'to' fraco em expressões como need to e want to." },
  "Call to book an appointment, then explain that you have to change it. Suggest a new time.": { pt: "Ligue para marcar um horário e depois explique que precisa remarcá-lo. Sugira um novo horário." },
  "Use one booking phrase and one polite excuse (I'm afraid..., Something has come up).": { pt: "Use uma expressão para marcar e uma desculpa educada (I'm afraid..., Something has come up)." },
  "What happens across this conversation?": { pt: "O que acontece ao longo dessa conversa?" },
  "An appointment is booked and then changed": { pt: "Um horário é marcado e depois remarcado" },
  "A patient complains about a doctor": { pt: "Um paciente reclama de um médico" },
  "A clinic cancels all its appointments": { pt: "Uma clínica cancela todos os horários" },
  "Which day was not available?": { pt: "Qual dia não estava disponível?" },
  "Thursday": { pt: "Quinta-feira" },
  "Friday": { pt: "Sexta-feira" },
  "Tuesday": { pt: "Terça-feira" },
  "Why does Marta call the second time?": { pt: "Por que Marta liga pela segunda vez?" },
  "She cannot come on Friday": { pt: "Ela não pode ir na sexta" },
  "She wants a different doctor": { pt: "Ela quer outro médico" },
  "She forgot the address": { pt: "Ela esqueceu o endereço" },
  /* a2-clarification */
  "Lesson 35 — When You Don't Understand": { pt: "Lição 35 — Quando você não entende" },
  "Asking someone to repeat, slow down, or explain": { pt: "Pedir para repetir, falar mais devagar ou explicar" },
  "Keep a conversation going when you miss a word or lose the thread.": { pt: "Manter a conversa quando você perde uma palavra ou o fio da meada." },
  "Sorry? and Again? rise at the end; a flat tone sounds rude.": { pt: "Sorry? e Again? sobem no final; um tom plano soa grosseiro." },
  "Someone gives you an instruction you only half understand. Ask two different questions to make it clear.": { pt: "Alguém te dá uma instrução que você entendeu pela metade. Faça duas perguntas diferentes para esclarecer." },
  "Ask about one specific word or part, and check your understanding with So you mean...?": { pt: "Pergunte sobre uma palavra ou parte específica e confirme com So you mean...?" },
  "What is Paulo doing in this conversation?": { pt: "O que Paulo está fazendo nessa conversa?" },
  "Checking that he understood correctly": { pt: "Confirmando que entendeu corretamente" },
  "Refusing to do the work": { pt: "Recusando-se a fazer o trabalho" },
  "Asking for more money": { pt: "Pedindo mais dinheiro" },
  "When is the draft due now?": { pt: "Quando o rascunho vence agora?" },
  "Monday": { pt: "Segunda-feira" },
  "Next month": { pt: "No mês que vem" },
  "What does Paulo ask for at the end?": { pt: "O que Paulo pede no final?" },
  "An example": { pt: "Um exemplo" },
  "A written summary": { pt: "Um resumo por escrito" },
  "A longer deadline": { pt: "Um prazo maior" },
  /* b1-job-interviews */
  "Lesson 36 — Job Interviews": { pt: "Lição 36 — Entrevistas de emprego" },
  "Experience, strengths, and interview follow-ups": { pt: "Experiência, pontos fortes e retornos após a entrevista" },
  "Present your experience and strengths in an interview with evidence, not adjectives.": { pt: "Apresentar sua experiência e seus pontos fortes em uma entrevista com evidências, não com adjetivos." },
  "Contracted present perfect: I've worked, I've been, I've led.": { pt: "Present perfect contraído: I've worked, I've been, I've led." },
  "Answer the question 'What is your main strength?' with one strength and one concrete result that proves it.": { pt: "Responda à pergunta 'What is your main strength?' com um ponto forte e um resultado concreto que o comprove." },
  "Replace any adjective about yourself with something you actually did and its outcome.": { pt: "Troque qualquer adjetivo sobre você por algo que você realmente fez e o resultado disso." },
  "How does Renata support her claim about her strength?": { pt: "Como Renata sustenta o que diz sobre seu ponto forte?" },
  "With a concrete result from her last job": { pt: "Com um resultado concreto do último emprego" },
  "By repeating the word 'organised'": { pt: "Repetindo a palavra 'organised'" },
  "By comparing herself to her colleagues": { pt: "Comparando-se aos colegas" },
  "How long has Renata worked in logistics?": { pt: "Há quanto tempo Renata trabalha com logística?" },
  "Six years": { pt: "Seis anos" },
  "Six months": { pt: "Seis meses" },
  "Three years": { pt: "Três anos" },
  "How does she explain leaving her current company?": { pt: "Como ela explica a saída da empresa atual?" },
  "She wants more responsibility": { pt: "Ela quer mais responsabilidade" },
  "She dislikes her manager": { pt: "Ela não gosta do gestor dela" },
  "The company is closing": { pt: "A empresa está fechando" },
  /* b1-work-meetings */
  "Lesson 37 — Meetings": { pt: "Lição 37 — Reuniões" },
  "Giving updates, asking questions, and agreeing action items": { pt: "Dar atualizações, fazer perguntas e definir próximos passos" },
  "Give a status update in a meeting and leave with clear action items.": { pt: "Dar uma atualização de status em uma reunião e sair com próximos passos claros." },
  "Falling tone on decisions, rising tone on checks: We'll ship Friday. Agreed?": { pt: "Tom descendente nas decisões, ascendente nas confirmações: We'll ship Friday. Agreed?" },
  "Give a one-minute update on something you are working on. Include one problem and one action item with a deadline.": { pt: "Dê uma atualização de um minuto sobre algo em que você trabalha. Inclua um problema e um próximo passo com prazo." },
  "Make sure your update says who does what by when, not only how you feel about the work.": { pt: "Garanta que sua atualização diga quem faz o quê e até quando, não só como você se sente." },
  "What is the purpose of this meeting?": { pt: "Qual é o objetivo dessa reunião?" },
  "Sharing status and assigning next steps": { pt: "Compartilhar status e definir próximos passos" },
  "Interviewing a new supplier": { pt: "Entrevistar um novo fornecedor" },
  "Training the team on a tool": { pt: "Treinar a equipe em uma ferramenta" },
  "What is holding Tomás up?": { pt: "O que está atrasando Tomás?" },
  "He is waiting on the supplier": { pt: "Ele está esperando o fornecedor" },
  "He has lost the report": { pt: "Ele perdeu o relatório" },
  "He is on holiday next week": { pt: "Ele estará de férias na semana que vem" },
  "What does Tomás commit to at the end?": { pt: "Com o que Tomás se compromete no final?" },
  "Sending the report by Wednesday": { pt: "Enviar o relatório até quarta" },
  "Rewriting the whole process": { pt: "Reescrever todo o processo" },
  "Cancelling the supplier contract": { pt: "Cancelar o contrato do fornecedor" },
  /* b1-email-messages */
  "Lesson 38 — Email and Messages": { pt: "Lição 38 — E-mails e mensagens" },
  "Professional tone in email and chat": { pt: "Tom profissional em e-mails e no chat" },
  "Write a short professional message that is direct without sounding cold.": { pt: "Escrever uma mensagem profissional curta, direta e sem soar fria." },
  "Read your message aloud: if it sounds abrupt, it reads abrupt.": { pt: "Leia sua mensagem em voz alta: se soa ríspida, ela é lida como ríspida." },
  "Rewrite this message so it stays direct but sounds polite: 'Send me the report today.'": { pt: "Reescreva esta mensagem para que continue direta, mas soe educada: 'Send me the report today.'" },
  "Keep the request and the deadline. Add a reason for writing and one closing line.": { pt: "Mantenha o pedido e o prazo. Acrescente um motivo para escrever e uma linha de encerramento." },
  "Why did Júlia's first message sound rude?": { pt: "Por que a primeira mensagem de Júlia soou grosseira?" },
  "It gave an order with no context": { pt: "Deu uma ordem sem contexto" },
  "It was far too long": { pt: "Estava longa demais" },
  "It contained spelling mistakes": { pt: "Tinha erros de ortografia" },
  "What does Sam tell her to start with?": { pt: "Com o que Sam diz que ela deve começar?" },
  "The reason she is writing": { pt: "O motivo de estar escrevendo" },
  "An apology": { pt: "Um pedido de desculpas" },
  "The invoice number": { pt: "O número da fatura" },
  "What does Sam say about the deadline?": { pt: "O que Sam diz sobre o prazo?" },
  "She should keep it": { pt: "Ela deve mantê-lo" },
  "She should remove it": { pt: "Ela deve removê-lo" },
  "She should make it later": { pt: "Ela deve adiá-lo" },
  /* b1-travel-problems */
  "Lesson 39 — When Travel Goes Wrong": { pt: "Lição 39 — Quando a viagem dá errado" },
  "Missed connections, lost items, and finding alternatives": { pt: "Conexões perdidas, itens extraviados e alternativas" },
  "Explain what went wrong on a trip and negotiate a workable alternative.": { pt: "Explicar o que deu errado em uma viagem e negociar uma alternativa viável." },
  "Stay calm and level: stress the facts, not the frustration.": { pt: "Mantenha a calma e o tom neutro: enfatize os fatos, não a frustração." },
  "Your flight was cancelled and you must be somewhere tomorrow. Explain the problem and ask for two alternatives.": { pt: "Seu voo foi cancelado e você precisa estar em outro lugar amanhã. Explique o problema e peça duas alternativas." },
  "Separate the facts from the request: say what happened, then ask what your options are.": { pt: "Separe os fatos do pedido: diga o que aconteceu e depois pergunte quais são suas opções." },
  "What is Marcos trying to achieve?": { pt: "O que Marcos está tentando conseguir?" },
  "A way to reach Lisbon tonight": { pt: "Uma forma de chegar a Lisboa hoje à noite" },
  "A refund for his suitcase": { pt: "Um reembolso pela mala" },
  "An upgrade to business class": { pt: "Um upgrade para a classe executiva" },
  "Why did he miss his connection?": { pt: "Por que ele perdeu a conexão?" },
  "His first flight landed late": { pt: "O primeiro voo dele pousou atrasado" },
  "He arrived at the airport late": { pt: "Ele chegou atrasado ao aeroporto" },
  "He went to the wrong gate": { pt: "Ele foi ao portão errado" },
  "What alternative does the agent offer?": { pt: "Que alternativa o atendente oferece?" },
  "A train he must pay for": { pt: "Um trem que ele mesmo precisa pagar" },
  "A free hotel room": { pt: "Um quarto de hotel gratuito" },
  "A flight with another airline": { pt: "Um voo com outra companhia" },
  /* b1-personal-finance */
  "Lesson 40 — Money Decisions": { pt: "Lição 40 — Decisões de dinheiro" },
  "Budgets, bills, saving, and everyday money choices": { pt: "Orçamento, contas, poupança e escolhas do dia a dia" },
  "Talk about what you spend, what you save, and why a purchase is or is not worth it.": { pt: "Falar sobre o que você gasta, o que guarda e por que uma compra vale ou não a pena." },
  "Contracted 'used to' and 'have to': I usta, I hafta.": { pt: "As formas reduzidas de 'used to' e 'have to': I usta, I hafta." },
  "Describe one money decision you are weighing. Say what it costs, what you would give up, and whether it is worth it.": { pt: "Descreva uma decisão financeira que você está avaliando. Diga quanto custa, do que abriria mão e se vale a pena." },
  "Use one value phrase (worth it, afford, pays for itself) and give an actual reason.": { pt: "Use uma expressão de valor (worth it, afford, pays for itself) e dê um motivo concreto." },
  "What are Léo and Bia deciding?": { pt: "O que Léo e Bia estão decidindo?" },
  "Whether Léo can afford a car": { pt: "Se Léo consegue pagar um carro" },
  "Where Léo should live": { pt: "Onde Léo deveria morar" },
  "How much rent to pay": { pt: "Quanto pagar de aluguel" },
  "What already takes most of Léo's salary?": { pt: "O que já consome a maior parte do salário de Léo?" },
  "Rent": { pt: "Aluguel" },
  "Food": { pt: "Comida" },
  // "Travel" is already translated above as an onboarding topic.
  "What does Léo prefer to do?": { pt: "O que Léo prefere fazer?" },
  "Save up rather than borrow": { pt: "Juntar dinheiro em vez de pegar emprestado" },
  "Borrow from the bank": { pt: "Pegar emprestado no banco" },
  "Ask his family for money": { pt: "Pedir dinheiro à família" },
  /* b1-storytelling */
  "Lesson 41 — Telling a Story": { pt: "Lição 41 — Contando uma história" },
  "Sequencing events and adding detail to a personal story": { pt: "Ordenar acontecimentos e acrescentar detalhes a uma história pessoal" },
  "Tell a personal story in order, with background detail and a point at the end.": { pt: "Contar uma história pessoal em ordem, com detalhes de contexto e um desfecho." },
  "Slow down before the punchline; pause where the listener should react.": { pt: "Desacelere antes do desfecho; faça uma pausa onde o ouvinte deve reagir." },
  "Tell a short story about something unexpected that happened to you. Set the scene, say what interrupted it, and end with the outcome.": { pt: "Conte uma história curta sobre algo inesperado que aconteceu com você. Situe a cena, diga o que a interrompeu e termine com o desfecho." },
  "Use one past continuous to set the scene and one closing phrase (in the end, ever since then).": { pt: "Use um past continuous para situar a cena e uma expressão de fechamento (in the end, ever since then)." },
  "What is Rafa's story about?": { pt: "Sobre o que é a história de Rafa?" },
  "An unexpected meeting at a bus stop": { pt: "Um encontro inesperado num ponto de ônibus" },
  "A bad day at school": { pt: "Um dia ruim na escola" },
  "A journey he never finished": { pt: "Uma viagem que ele nunca terminou" },
  "What happened first?": { pt: "O que aconteceu primeiro?" },
  "He was waiting for the bus": { pt: "Ele estava esperando o ônibus" },
  "He recognised his teacher": { pt: "Ele reconheceu a professora" },
  "They missed the bus": { pt: "Eles perderam o ônibus" },
  "Why didn't he recognise her immediately?": { pt: "Por que ele não a reconheceu na hora?" },
  "He had never seen her outside school": { pt: "Ele nunca a tinha visto fora da escola" },
  "She had changed her name": { pt: "Ela tinha mudado de nome" },
  "It was too dark": { pt: "Estava escuro demais" },
  /* b1-recommendations */
  "Lesson 42 — Recommendations": { pt: "Lição 42 — Recomendações" },
  "Recommending things and backing the recommendation with reasons": { pt: "Recomendar algo e sustentar a recomendação com motivos" },
  "Recommend or warn against something and justify it with a reason and a caveat.": { pt: "Recomendar algo ou desaconselhar, justificando com um motivo e uma ressalva." },
  "Stress the reason, not the adjective: it's great BECAUSE it's quiet.": { pt: "Enfatize o motivo, não o adjetivo: it's great BECAUSE it's quiet." },
  "Recommend a place, film, or app to someone. Give one reason, one downside, and say who it suits.": { pt: "Recomende um lugar, filme ou aplicativo. Dê um motivo, um ponto negativo e diga para quem serve." },
  "A recommendation without a reason is just an opinion. Add why, and add one honest downside.": { pt: "Uma recomendação sem motivo é só uma opinião. Acrescente o porquê e um ponto negativo honesto." },
  "What is Gui doing?": { pt: "O que Gui está fazendo?" },
  "Recommending a restaurant with an honest caveat": { pt: "Recomendando um restaurante com uma ressalva honesta" },
  "Warning Tati not to go out": { pt: "Avisando Tati para não sair" },
  "Complaining about a bad meal": { pt: "Reclamando de uma refeição ruim" },
  "What did Gui like most?": { pt: "Do que Gui mais gostou?" },
  "The service": { pt: "Do atendimento" },
  "The music": { pt: "Da música" },
  "The location": { pt: "Da localização" },
  "What downside does he admit?": { pt: "Que ponto negativo ele admite?" },
  "It is expensive": { pt: "É caro" },
  "It is far away": { pt: "É longe" },
  "It is always full": { pt: "Está sempre lotado" },
  /* b1-apologies */
  "Lesson 43 — Apologising and Fixing It": { pt: "Lição 43 — Pedir desculpas e resolver" },
  "Taking responsibility and repairing a situation": { pt: "Assumir responsabilidade e consertar a situação" },
  "Apologise for a real mistake, take responsibility, and propose the repair.": { pt: "Pedir desculpas por um erro real, assumir a responsabilidade e propor a solução." },
  "A sincere apology is slower and lower; speed sounds defensive.": { pt: "Um pedido de desculpas sincero é mais lento e mais grave; pressa soa defensiva." },
  "You missed a deadline that affected someone else. Apologise, take responsibility, and propose one concrete fix.": { pt: "Você perdeu um prazo e isso afetou outra pessoa. Peça desculpas, assuma a responsabilidade e proponha uma solução concreta." },
  "Check that your apology contains no 'but'. Then add one specific thing you will change.": { pt: "Verifique se seu pedido de desculpas não tem nenhum 'but'. Depois acrescente algo específico que você vai mudar." },
  "How does Dani handle the complaint?": { pt: "Como Dani lida com a reclamação?" },
  "She takes responsibility and offers a fix": { pt: "Ela assume a responsabilidade e propõe uma solução" },
  "She blames her team": { pt: "Ela culpa a equipe dela" },
  "She denies the report was late": { pt: "Ela nega que o relatório atrasou" },
  "What does the client say the delay caused?": { pt: "O que o cliente diz que o atraso causou?" },
  "The review had to be postponed": { pt: "A revisão teve que ser adiada" },
  "The contract was cancelled": { pt: "O contrato foi cancelado" },
  "The team lost a client": { pt: "A equipe perdeu um cliente" },
  "What does Dani promise at the end?": { pt: "O que Dani promete no final?" },
  "A status note every Friday": { pt: "Um informe de status toda sexta" },
  "A full refund": { pt: "Um reembolso total" },
  "A new project manager": { pt: "Um novo gerente de projeto" },
  /* a1-classroom */
  "Lesson 44 — In the Classroom": { pt: "Lição 44 — Na sala de aula" },
  "Classroom objects and simple instructions": { pt: "Objetos da sala de aula e instruções simples" },
  "Follow simple classroom instructions and ask for the things you need.": { pt: "Seguir instruções simples em sala e pedir o que você precisa." },
  "Stress the important word in a question: Which PAGE? What WORD?": { pt: "Enfatize a palavra importante na pergunta: Which PAGE? What WORD?" },
  "You are in class. Ask which page to open, say you do not have one object, and ask to borrow it.": { pt: "Você está em aula. Pergunte qual página deve abrir, diga que não tem um objeto e peça-o emprestado." },
  "Use Which page...? for the instruction and Can I borrow...? for the object.": { pt: "Use Which page...? para a instrução e Can I borrow...? para o objeto." },
  "What are the students getting ready to do?": { pt: "O que os alunos estão se preparando para fazer?" },
  "An activity in pairs": { pt: "Uma atividade em duplas" },
  "A test on their own": { pt: "Uma prova individual" },
  "A game outside": { pt: "Um jogo do lado de fora" },
  "Which page do they need?": { pt: "De qual página eles precisam?" },
  "Page eighteen": { pt: "Página dezoito" },
  "Page eight": { pt: "Página oito" },
  "Page eighty": { pt: "Página oitenta" },
  "What does Lia borrow?": { pt: "O que Lia pega emprestado?" },
  "A pen": { pt: "Uma caneta" },
  "A book": { pt: "Um livro" },
  "A phone": { pt: "Um celular" },
  /* a1-time-dates */
  "Lesson 45 — Time and Dates": { pt: "Lição 45 — Horários e datas" },
  "Clock time, days, dates, and schedules": { pt: "Horas, dias, datas e horários" },
  "Ask and answer basic questions about times, days, and dates.": { pt: "Fazer e responder perguntas básicas sobre horários, dias e datas." },
  "Keep thirteen and thirty distinct: thirTEEN, THIRty.": { pt: "Diferencie thirteen de thirty: thirTEEN, THIRty." },
  "Tell a classmate the day, date, and time of your next class or appointment, then say if you are early or late.": { pt: "Diga a um colega o dia, a data e a hora da sua próxima aula ou compromisso; depois diga se você está adiantado ou atrasado." },
  "Use on before the day or date and at before the clock time.": { pt: "Use on antes do dia ou da data e at antes do horário." },
  "What are Ivo and Maya checking?": { pt: "O que Ivo e Maya estão conferindo?" },
  "The date and time of a class": { pt: "A data e o horário de uma aula" },
  "The price of a course": { pt: "O preço de um curso" },
  "The address of a café": { pt: "O endereço de um café" },
  "When is the class?": { pt: "Quando é a aula?" },
  "Tuesday, May twelfth": { pt: "Terça-feira, doze de maio" },
  "Thursday, May twentieth": { pt: "Quinta-feira, vinte de maio" },
  "Tuesday, March twelfth": { pt: "Terça-feira, doze de março" },
  "How early is Ivo?": { pt: "Quanto tempo adiantado Ivo está?" },
  "Fifteen minutes": { pt: "Quinze minutos" },
  "Five minutes": { pt: "Cinco minutos" },
  "Thirty minutes": { pt: "Trinta minutos" },
  /* a1-likes */
  "Lesson 46 — Things You Like": { pt: "Lição 46 — Coisas de que você gosta" },
  "Likes, dislikes, and simple reasons": { pt: "Gostos, preferências e motivos simples" },
  "Talk about things you like and dislike and give a simple reason.": { pt: "Falar sobre coisas de que você gosta ou não e dar um motivo simples." },
  "Stress the thing you contrast: I like TEA, but I don't like COFFEE.": { pt: "Enfatize as coisas que você contrasta: I like TEA, but I don't like COFFEE." },
  "Talk about one kind of music, food, or film you like and one you do not like. Give a reason for each.": { pt: "Fale sobre um tipo de música, comida ou filme de que você gosta e outro de que não gosta. Dê um motivo para cada um." },
  "Add because after each opinion so the listener knows your reason.": { pt: "Acrescente because depois de cada opinião para que o ouvinte saiba o motivo." },
  "What are Ana and Caio talking about?": { pt: "Sobre o que Ana e Caio estão conversando?" },
  "Their taste in music": { pt: "O gosto musical deles" },
  "A film they watched": { pt: "Um filme a que assistiram" },
  "Food for a party": { pt: "Comida para uma festa" },
  "Why does Ana like pop music?": { pt: "Por que Ana gosta de música pop?" },
  "Because it is fun": { pt: "Porque é divertida" },
  "Because it is quiet": { pt: "Porque é tranquila" },
  "Because it is new": { pt: "Porque é nova" },
  "What does Ana prefer?": { pt: "O que Ana prefere?" },
  "Faster songs": { pt: "Músicas mais rápidas" },
  "Slower songs": { pt: "Músicas mais lentas" },
  "Scary films": { pt: "Filmes de terror" },
  /* a1-abilities */
  "Lesson 47 — What You Can Do": { pt: "Lição 47 — O que você sabe fazer" },
  "Abilities, help, and learning a skill": { pt: "Habilidades, ajuda e aprendizado" },
  "Say what you can and cannot do and ask someone to show or help you.": { pt: "Dizer o que você sabe ou não sabe fazer e pedir que alguém mostre ou ajude." },
  "Can is usually weak in statements; can't is stressed: I can SWIM. I CAN'T DRIVE.": { pt: "Can costuma ser fraco nas afirmações; can't recebe ênfase: I can SWIM. I CAN'T DRIVE." },
  "Name one thing you can do well and one thing you cannot do yet. Ask someone to show you one step.": { pt: "Diga algo que você sabe fazer bem e algo que ainda não sabe. Peça que alguém mostre um passo." },
  "Use can or can't plus the base verb, then ask Could you show me...?": { pt: "Use can ou can't com o verbo base; depois pergunte Could you show me...?" },
  "What is Bela helping Niko do?": { pt: "O que Bela está ajudando Niko a fazer?" },
  "Draw a face": { pt: "Desenhar um rosto" },
  "Drive a car": { pt: "Dirigir um carro" },
  "Cook a meal": { pt: "Preparar uma refeição" },
  "What is Bela good at drawing?": { pt: "O que Bela sabe desenhar bem?" },
  Faces: { pt: "Rostos" },
  Houses: { pt: "Casas" },
  Animals: { pt: "Animais" },
  "What does Niko draw after the circle?": { pt: "O que Niko desenha depois do círculo?" },
  "The eyes": { pt: "Os olhos" },
  "The mouth": { pt: "A boca" },
  "The hair": { pt: "O cabelo" },
  /* a2-responsibilities */
  "Lesson 48 — Sharing Responsibilities": { pt: "Lição 48 — Dividindo responsabilidades" },
  "Chores, responsibilities, and routine obligations": { pt: "Tarefas domésticas, responsabilidades e obrigações da rotina" },
  "Explain routine responsibilities and agree who will do each task.": { pt: "Explicar responsabilidades da rotina e combinar quem fará cada tarefa." },
  "Have to often sounds like hafta in natural speech: I hafta clean.": { pt: "Have to muitas vezes soa como hafta na fala natural: I hafta clean." },
  "You share a home with someone. Divide three chores between you and say when you will do your tasks.": { pt: "Você divide a casa com alguém. Distribua três tarefas e diga quando fará as suas." },
  "Use responsible for or my turn for ownership, then give a clear time with I'll...": { pt: "Use responsible for ou my turn para indicar responsabilidade; depois dê um horário claro com I'll..." },
  "What are Rui and Cris doing?": { pt: "O que Rui e Cris estão fazendo?" },
  "Dividing the housework before guests arrive": { pt: "Dividindo as tarefas antes de os convidados chegarem" },
  "Planning a shopping trip for next week": { pt: "Planejando uma ida às compras para a semana que vem" },
  "Looking for someone to clean their home": { pt: "Procurando alguém para limpar a casa" },
  "Which room will Cris clean?": { pt: "Qual cômodo Cris vai limpar?" },
  "The bathroom": { pt: "O banheiro" },
  "The kitchen": { pt: "A cozinha" },
  "The bedroom": { pt: "O quarto" },
  "What did Cris forget to do?": { pt: "O que Cris esqueceu de fazer?" },
  "Take the rubbish out": { pt: "Levar o lixo para fora" },
  "Buy the food": { pt: "Comprar a comida" },
  "Wash the dishes": { pt: "Lavar a louça" },
  /* a2-technology */
  "Lesson 49 — Everyday Technology": { pt: "Lição 49 — Tecnologia do dia a dia" },
  "Devices, messages, passwords, and basic problems": { pt: "Aparelhos, mensagens, senhas e problemas básicos" },
  "Describe a common technology problem, follow a simple suggestion, and confirm whether it worked.": {
    pt: "Descrever um problema comum de tecnologia, seguir uma sugestão simples e confirmar se funcionou.",
  },
  "Stress the problem word: My phone won't turn ON. The battery is almost DEAD.": {
    pt: "Enfatize a palavra que indica o problema: My phone won't turn ON. The battery is almost DEAD.",
  },
  "Your phone or computer has a simple problem. Describe it, ask for help, and say whether the suggested solution works.": {
    pt: "Seu celular ou computador está com um problema simples. Descreva-o, peça ajuda e diga se a solução sugerida funciona.",
  },
  "Name the exact problem with won't or can't, then respond to one suggestion with Try... or It works now.": {
    pt: "Diga qual é o problema com won't ou can't; depois responda a uma sugestão com Try... ou It works now.",
  },
  "What problem does Leo solve?": { pt: "Que problema Leo resolve?" },
  "He connects to the Wi-Fi": { pt: "Ele se conecta ao Wi-Fi" },
  "He repairs a broken screen": { pt: "Ele conserta uma tela quebrada" },
  "He buys a new phone": { pt: "Ele compra um celular novo" },
  "Why did the first password fail?": { pt: "Por que a primeira senha não funcionou?" },
  "It was the old password": { pt: "Era a senha antiga" },
  "Leo typed his name": { pt: "Leo digitou o nome dele" },
  "The network had no password": { pt: "A rede não tinha senha" },
  "What does Leo ask for after the Wi-Fi works?": { pt: "O que Leo pede depois que o Wi-Fi funciona?" },
  "The call link": { pt: "O link da chamada" },
  "A phone charger": { pt: "Um carregador de celular" },
  "An app update": { pt: "Uma atualização do aplicativo" },
  /* a2-comparisons */
  "Lesson 50 — Comparing Options": { pt: "Lição 50 — Comparando opções" },
  "Comparing people, places, and products": { pt: "Comparação de pessoas, lugares e produtos" },
  "Compare two products using clear differences and choose the better option for a need.": {
    pt: "Comparar dois produtos com diferenças claras e escolher a melhor opção para uma necessidade.",
  },
  "Stress the comparative word: CHEAPer, MORE comfortable, NOT as heavy.": {
    pt: "Enfatize a palavra comparativa: CHEAPer, MORE comfortable, NOT as heavy.",
  },
  "Compare two phones, bags, places, or other familiar options. Give two differences and choose one for a specific need.": {
    pt: "Compare dois celulares, bolsas, lugares ou outras opções conhecidas. Dê duas diferenças e escolha uma para uma necessidade específica.",
  },
  "Use one comparative with than and one not as ... as sentence before you state your choice.": {
    pt: "Use um comparativo com than e uma frase com not as ... as antes de dizer sua escolha.",
  },
  "What are Nina and Tom deciding?": { pt: "O que Nina e Tom estão decidindo?" },
  "Which travel bag to buy": { pt: "Qual mala de viagem comprar" },
  "Where to go on holiday": { pt: "Onde passar as férias" },
  "How to repair a suitcase": { pt: "Como consertar uma mala" },
  "How are the two bags similar?": { pt: "Em que as duas malas são parecidas?" },
  "They are about the same size": { pt: "Elas têm mais ou menos o mesmo tamanho" },
  "They cost the same": { pt: "Elas custam o mesmo" },
  "They are the same colour": { pt: "Elas têm a mesma cor" },
  "Why does Nina prefer the blue bag?": { pt: "Por que Nina prefere a mala azul?" },
  "It is lighter and more comfortable": { pt: "Ela é mais leve e mais confortável" },
  "It is cheaper and larger": { pt: "Ela é mais barata e maior" },
  "It has a longer guarantee": { pt: "Ela tem uma garantia mais longa" },
  /* a2-childhood */
  "Lesson 51 — Childhood Memories": { pt: "Lição 51 — Lembranças da infância" },
  "Childhood routines and simple memories": { pt: "Rotinas da infância e lembranças simples" },
  "Describe where you grew up and share a few simple childhood habits and memories.": {
    pt: "Descrever onde você cresceu e compartilhar alguns hábitos e lembranças simples da infância.",
  },
  "Used to links together in speech: I used_to play; Did_you use_to walk?": {
    pt: "Used to se liga às outras palavras na fala: I used_to play; Did_you use_to walk?",
  },
  "Describe where you grew up. Share two things you used to do and one thing you did not have or do.": {
    pt: "Descreva onde você cresceu. Conte duas coisas que costumava fazer e uma coisa que não tinha ou não fazia.",
  },
  "Use used to for repeated habits and the past simple for one fact or period.": {
    pt: "Use used to para hábitos repetidos e o passado simples para um fato ou período.",
  },
  "What is Sam describing?": { pt: "O que Sam está descrevendo?" },
  "His childhood in a small town": { pt: "A infância dele em uma cidade pequena" },
  "His first job in a city": { pt: "O primeiro emprego dele em uma cidade" },
  "His plans to visit his cousins": { pt: "Os planos dele de visitar os primos" },
  "Who lived near Sam?": { pt: "Quem morava perto de Sam?" },
  "His grandparents": { pt: "Os avós dele" },
  "His teacher": { pt: "O professor dele" },
  "His best friend": { pt: "O melhor amigo dele" },
  "What did Sam do after school?": { pt: "O que Sam fazia depois da escola?" },
  "He played outside with his cousins": { pt: "Ele brincava fora com os primos" },
  "He called friends on his phone": { pt: "Ele ligava para os amigos pelo celular" },
  "He worked in his grandparents' shop": { pt: "Ele trabalhava na loja dos avós" },
  /* a2-obligations */
  "Lesson 52 — Rules and Permissions": { pt: "Lição 52 — Regras e permissões" },
  "Rules with have to, must, and can": { pt: "Regras com have to, must e can" },
  "Ask about and explain rules, permission, and what is or is not required in a public place.": {
    pt: "Perguntar e explicar regras, permissões e o que é ou não obrigatório em um lugar público.",
  },
  "Contrast must and mustn't clearly; the final t helps the listener hear the rule.": {
    pt: "Diferencie must de mustn't com clareza; o t final ajuda quem ouve a entender a regra.",
  },
  "Explain three rules for a museum, workplace, school, or other familiar place. Include one thing that is optional.": {
    pt: "Explique três regras de um museu, local de trabalho, escola ou outro lugar conhecido. Inclua algo que seja opcional.",
  },
  "Use must or have to for a requirement, can't for a prohibition, and don't have to for something optional.": {
    pt: "Use must ou have to para uma obrigação, can't para uma proibição e don't have to para algo opcional.",
  },
  "What is the guide explaining?": { pt: "O que o guia está explicando?" },
  "The rules for visiting a place": { pt: "As regras para visitar um lugar" },
  "The route to a train station": { pt: "O caminho até uma estação de trem" },
  "The price of different tickets": { pt: "O preço de ingressos diferentes" },
  "What must visitors show?": { pt: "O que os visitantes devem mostrar?" },
  "Their ID": { pt: "O documento deles" },
  "A photograph": { pt: "Uma fotografia" },
  "Their bags": { pt: "As bolsas deles" },
  "What are visitors allowed to do?": { pt: "O que os visitantes podem fazer?" },
  "Take photos without a flash": { pt: "Tirar fotos sem flash" },
  "Bring food inside": { pt: "Entrar com comida" },
  "Stay after six": { pt: "Ficar depois das seis" },
  /* b1-reasons-examples */
  "Lesson 53 — Reasons and Examples": { pt: "Lição 53 — Motivos e exemplos" },
  "Explaining a point with reasons and examples": { pt: "Explicação de um ponto com motivos e exemplos" },
  "Support an opinion with an organised reason, a relevant example, and a fair limitation.": {
    pt: "Sustentar uma opinião com um motivo organizado, um exemplo relevante e uma ressalva justa.",
  },
  "Pause after signposts such as The main reason is... and For example... so the structure is easy to follow.": {
    pt: "Faça uma pausa depois de marcadores como The main reason is... e For example... para deixar a estrutura fácil de acompanhar.",
  },
  "Give your opinion about a change at work, school, or home. Support it with one main reason, one specific example, and one limitation.": {
    pt: "Dê sua opinião sobre uma mudança no trabalho, na escola ou em casa. Sustente-a com um motivo principal, um exemplo específico e uma ressalva.",
  },
  "Make the logic visible: state The main reason..., add For example..., then acknowledge a limit with That doesn't mean...": {
    pt: "Deixe a lógica visível: diga The main reason..., acrescente For example... e depois reconheça um limite com That doesn't mean...",
  },
  "What change does Jo suggest?": { pt: "Que mudança Jo sugere?" },
  "Using shorter meetings for weekly updates": { pt: "Usar reuniões mais curtas para atualizações semanais" },
  "Cancelling every team meeting": { pt: "Cancelar todas as reuniões da equipe" },
  "Moving all projects to Friday": { pt: "Passar todos os projetos para sexta-feira" },
  "What example supports Jo's point?": { pt: "Que exemplo sustenta o ponto de Jo?" },
  "Their Friday check-in takes twenty minutes": { pt: "A reunião rápida de sexta-feira leva vinte minutos" },
  "The team works from home twice a week": { pt: "A equipe trabalha de casa duas vezes por semana" },
  "A client cancelled a long meeting": { pt: "Um cliente cancelou uma reunião longa" },
  "What limitation do Jo and Ben recognise?": { pt: "Que ressalva Jo e Ben reconhecem?" },
  "Some projects need more discussion": { pt: "Alguns projetos precisam de mais discussão" },
  "Short meetings always cost more": { pt: "Reuniões curtas sempre custam mais" },
  "Weekly updates need every team member": { pt: "Atualizações semanais precisam de todos da equipe" },
  /* b1-news-media */
  "Lesson 54 — Reading the News Carefully": { pt: "Lição 54 — Lendo notícias com atenção" },
  "Summarising news and distinguishing fact from opinion": {
    pt: "Resumo de notícias e distinção entre fato e opinião",
  },
  "Summarise a news report, identify what is confirmed, and explain why a claim needs checking.": {
    pt: "Resumir uma notícia, identificar o que está confirmado e explicar por que uma afirmação precisa ser verificada.",
  },
  "Stress source and certainty words: ACCORDING to the report; it has NOT been confirmed YET.": {
    pt: "Enfatize as palavras de fonte e certeza: ACCORDING to the report; it has NOT been confirmed YET.",
  },
  "Summarise a news story or online claim. Attribute the information, say what is confirmed, and name one detail you would check.": {
    pt: "Resuma uma notícia ou afirmação on-line. Atribua a informação, diga o que está confirmado e mencione um detalhe que você verificaria.",
  },
  "Separate the source from the claim with According to..., then use confirmed, evidence, or opinion to show how certain it is.": {
    pt: "Separe a fonte da afirmação com According to...; depois use confirmed, evidence ou opinion para mostrar o grau de certeza.",
  },
  "Why does Owen question the headline?": { pt: "Por que Owen questiona a manchete?" },
  "It presents a possible change as a final decision": {
    pt: "Ela apresenta uma possível mudança como decisão final",
  },
  "It describes a meeting that happened last year": {
    pt: "Ela descreve uma reunião que aconteceu no ano passado",
  },
  "It reports the wrong location for the park": { pt: "Ela informa o local errado do parque" },
  "What has the council actually done?": { pt: "O que a prefeitura realmente fez?" },
  "It has considered charging an entrance fee": { pt: "Ela considerou cobrar uma taxa de entrada" },
  "It has closed the park permanently": { pt: "Ela fechou o parque permanentemente" },
  "It has cancelled the public meeting": { pt: "Ela cancelou a reunião pública" },
  "Which source does Owen suggest checking?": { pt: "Qual fonte Owen sugere verificar?" },
  "The official city website": { pt: "O site oficial da cidade" },
  "A comment below the article": { pt: "Um comentário abaixo da matéria" },
  "An advertisement for the park": { pt: "Um anúncio do parque" },
  /* b1-health-fitness */
  "Lesson 55 — A Routine You Can Keep": { pt: "Lição 55 — Uma rotina que você consegue manter" },
  "Exercise, wellbeing, and sustainable routines": {
    pt: "Exercício, bem-estar e rotinas sustentáveis",
  },
  "Describe an exercise routine, discuss a common obstacle, and suggest a realistic way to make the routine sustainable.": {
    pt: "Descrever uma rotina de exercícios, discutir um obstáculo comum e sugerir uma maneira realista de manter a rotina.",
  },
  "Stress the contrast in sustainable advice: start SLOWLY, then build up GRADUALLY.": {
    pt: "Enfatize o contraste em conselhos sustentáveis: start SLOWLY, then build up GRADUALLY.",
  },
  "Describe a realistic wellbeing or exercise routine. Explain one obstacle, one adjustment that makes it easier to maintain, and one effect you have noticed or expect.": {
    pt: "Descreva uma rotina realista de bem-estar ou exercícios. Explique um obstáculo, um ajuste que facilite mantê-la e um efeito que você percebeu ou espera.",
  },
  "Use tend to for the obstacle, stick to for sustainability, and one gradual or short alternative instead of making an extreme plan.": {
    pt: "Use tend to para o obstáculo, stick to para a continuidade e uma alternativa gradual ou curta em vez de fazer um plano extremo.",
  },
  "What are Maya and Dan trying to improve?": { pt: "O que Maya e Dan estão tentando melhorar?" },
  "How sustainable Maya's exercise routine is": { pt: "A sustentabilidade da rotina de exercícios de Maya" },
  "How quickly Maya can enter a competition": { pt: "Em quanto tempo Maya pode entrar em uma competição" },
  "How much sports equipment Maya owns": { pt: "Quantos equipamentos esportivos Maya possui" },
  "What makes Maya miss workouts?": { pt: "O que faz Maya perder treinos?" },
  "Being busy": { pt: "Estar ocupada" },
  "Sleeping too much": { pt: "Dormir demais" },
  "Training with Dan": { pt: "Treinar com Dan" },
  "What positive change has Maya noticed?": { pt: "Que mudança positiva Maya percebeu?" },
  "She sleeps better": { pt: "Ela dorme melhor" },
  "She works fewer hours": { pt: "Ela trabalha menos horas" },
  "She runs every morning": { pt: "Ela corre todas as manhãs" },
  /* b1-habits-change */
  "Lesson 56 — Changing a Habit": { pt: "Lição 56 — Mudando um hábito" },
  "Describing change, setbacks, and progress": { pt: "Descrição de mudanças, recaídas e progresso" },
  "Compare a past habit with the present, describe a setback, and explain one strategy that supports progress.": {
    pt: "Comparar um hábito passado com o presente, descrever uma recaída e explicar uma estratégia que favorece o progresso.",
  },
  "Contrast past and present time markers: I USED to check; NOW I leave it outside.": {
    pt: "Contraste os marcadores de passado e presente: I USED to check; NOW I leave it outside.",
  },
  "Describe a habit you changed or want to change. Compare the past with now, mention a setback or difficulty, and explain one strategy that helps.": {
    pt: "Descreva um hábito que você mudou ou quer mudar. Compare o passado com o presente, mencione uma recaída ou dificuldade e explique uma estratégia que ajuda.",
  },
  "Show the timeline with used to and now, then make the setback temporary by adding what helped or what you will try next.": {
    pt: "Mostre a linha do tempo com used to e now; depois mostre que a recaída é temporária acrescentando o que ajudou ou o que você tentará em seguida.",
  },
  "What habit is Priya changing?": { pt: "Que hábito Priya está mudando?" },
  "How she uses her phone around bedtime": { pt: "Como ela usa o celular perto da hora de dormir" },
  "How often she exercises at weekends": { pt: "Com que frequência ela se exercita nos fins de semana" },
  "How she organises her work meetings": { pt: "Como ela organiza as reuniões de trabalho" },
  "Which strategy helped Priya most?": { pt: "Qual estratégia mais ajudou Priya?" },
  "Leaving her phone outside the bedroom": { pt: "Deixar o celular fora do quarto" },
  "Buying a different phone": { pt: "Comprar outro celular" },
  "Waking up an hour earlier": { pt: "Acordar uma hora mais cedo" },
  "How does Cal describe Priya's setback?": { pt: "Como Cal descreve a recaída de Priya?" },
  "It does not erase her progress": { pt: "Ela não apaga o progresso de Priya" },
  "It proves her strategy cannot work": { pt: "Ela prova que a estratégia de Priya não funciona" },
  "It means she should make a bigger change": { pt: "Ela significa que Priya deveria fazer uma mudança maior" },
  /* b1-processes */
  "Lesson 57 — Explaining a Process": { pt: "Lição 57 — Explicando um processo" },
  "Explaining how a familiar process works": { pt: "Explicação de como funciona um processo conhecido" },
  "Explain a familiar process in a clear sequence, include a condition, and warn about one common problem.": {
    pt: "Explicar um processo conhecido em uma sequência clara, incluir uma condição e alertar sobre um problema comum.",
  },
  "Pause after sequence markers so each stage is clear: FIRST... ONCE that's done... AFTER that...": {
    pt: "Faça uma pausa depois dos marcadores de sequência para deixar cada etapa clara: FIRST... ONCE that's done... AFTER that...",
  },
  "Explain a familiar process such as returning an item, preparing a document, or using a service. Give the stages in order and include what to do if a problem occurs.": {
    pt: "Explique um processo conhecido, como devolver um item, preparar um documento ou usar um serviço. Apresente as etapas em ordem e inclua o que fazer se ocorrer um problema.",
  },
  "Guide the listener with first, once, and after that, then add one if sentence for the problem path.": {
    pt: "Oriente quem ouve com first, once e after that; depois acrescente uma frase com if para o caminho em caso de problema.",
  },
  "Which process does Max explain?": { pt: "Qual processo Max explica?" },
  "Returning an online order": { pt: "Devolver uma compra feita pela internet" },
  "Buying an item in a shop": { pt: "Comprar um item em uma loja" },
  "Repairing a damaged package": { pt: "Consertar um pacote danificado" },
  "What should Ana do before choosing a reason?": { pt: "O que Ana deve fazer antes de escolher um motivo?" },
  "Select the item on the returns page": { pt: "Selecionar o item na página de devoluções" },
  "Take the package to a collection point": { pt: "Levar o pacote a um ponto de coleta" },
  "Contact customer support": { pt: "Entrar em contato com o atendimento ao cliente" },
  "When should Ana contact customer support?": { pt: "Quando Ana deve entrar em contato com o atendimento ao cliente?" },
  "If something goes wrong": { pt: "Se algo der errado" },
  "Before she opens the returns page": { pt: "Antes de abrir a página de devoluções" },
  "After the refund arrives": { pt: "Depois que o reembolso chegar" },
  /* b1-goals-progress */
  "Lesson 58 — Goals and Progress": { pt: "Lição 58 — Metas e progresso" },
  "Setting goals and reflecting on progress": { pt: "Definição de metas e reflexão sobre o progresso" },
  "Define a specific goal, assess current progress, and choose a practical next step when the plan needs adjustment.": {
    pt: "Definir uma meta específica, avaliar o progresso atual e escolher um próximo passo prático quando o plano precisar de ajustes.",
  },
  "Stress progress contrasts: I'm ON TRACK with research, but I've FALLEN BEHIND with writing.": {
    pt: "Enfatize os contrastes de progresso: I'm ON TRACK with research, but I've FALLEN BEHIND with writing.",
  },
  "Describe one current goal. Explain how you measure progress, say what is on track or behind, and choose one specific next step.": {
    pt: "Descreva uma meta atual. Explique como você avalia o progresso, diga o que está dentro do prazo ou atrasado e escolha um próximo passo específico.",
  },
  "Make the goal measurable with a deadline or result, contrast on track with behind, and finish with My next step is to...": {
    pt: "Torne a meta mensurável com um prazo ou resultado, contraste on track com behind e termine com My next step is to...",
  },
  "What does Ravi realise about his project plan?": { pt: "O que Ravi percebe sobre o plano do projeto?" },
  "He needs to adjust it because the writing is behind": {
    pt: "Ele precisa ajustá-lo porque a parte escrita está atrasada",
  },
  "He has completed every section ahead of schedule": { pt: "Ele concluiu todas as seções antes do prazo" },
  "He needs to choose a different course": { pt: "Ele precisa escolher outro curso" },
  "Which part of the project is on track?": { pt: "Qual parte do projeto está dentro do prazo?" },
  "The research": { pt: "A pesquisa" },
  "The introduction": { pt: "A introdução" },
  "The final presentation": { pt: "A apresentação final" },
  "What is Ravi's immediate next step?": { pt: "Qual é o próximo passo imediato de Ravi?" },
  "Finish the introduction": { pt: "Terminar a introdução" },
  "Add three more sections": { pt: "Acrescentar mais três seções" },
  "Repeat all of the research": { pt: "Refazer toda a pesquisa" },
  /* b2-cause-effect */
  "Lesson 59 — Causes and Consequences": { pt: "Lição 59 — Causas e consequências" },
  "Explaining causes, consequences, and contributing factors": {
    pt: "Explicação de causas, consequências e fatores contribuintes",
  },
  "Explain a complex outcome by separating its immediate trigger, contributing factors, and wider consequences.": {
    pt: "Explicar um resultado complexo separando o gatilho imediato, os fatores contribuintes e as consequências mais amplas.",
  },
  "Use pauses to mark the causal chain: The supplier was late / which, in turn, delayed testing.": {
    pt: "Use pausas para marcar a cadeia causal: The supplier was late / which, in turn, delayed testing.",
  },
  "Explain a problem with more than one cause. Identify the immediate trigger, one underlying factor, and at least one consequence.": {
    pt: "Explique um problema com mais de uma causa. Identifique o gatilho imediato, um fator subjacente e pelo menos uma consequência.",
  },
  "Avoid a single-cause explanation: use largely due to or contributed to, connect the next result with in turn, and distinguish the trigger from the underlying cause.": {
    pt: "Evite uma explicação de causa única: use largely due to ou contributed to, conecte o resultado seguinte com in turn e diferencie o gatilho da causa subjacente.",
  },
  "How does Jon explain the launch delay?": { pt: "Como Jon explica o atraso no lançamento?" },
  "He describes a material shortage, a power cut, and a missing recovery plan": {
    pt: "Ele descreve uma falta de materiais, uma queda de energia e a ausência de um plano de recuperação",
  },
  "He blames the entire delay on one employee": { pt: "Ele atribui todo o atraso a um funcionário" },
  "He says the launch was deliberately postponed": { pt: "Ele diz que o lançamento foi adiado de propósito" },
  "What did the power cut immediately affect?": { pt: "O que a queda de energia afetou imediatamente?" },
  Production: { pt: "A produção" },
  "Customer demand": { pt: "A demanda dos clientes" },
  "The project budget": { pt: "O orçamento do projeto" },
  "What prevented the delay from becoming longer?": { pt: "O que evitou que o atraso fosse maior?" },
  "The backup supplier": { pt: "O fornecedor reserva" },
  "A larger testing team": { pt: "Uma equipe de testes maior" },
  "An earlier launch date": { pt: "Uma data de lançamento antecipada" },
  /* b2-persuasion */
  "Lesson 60 — Making a Persuasive Case": { pt: "Lição 60 — Construindo um argumento persuasivo" },
  "Persuading without overstating a claim": { pt: "Persuasão sem exagerar uma afirmação" },
  "Build a persuasive recommendation with relevant benefits, measured claims, and a practical response to concerns.": {
    pt: "Construir uma recomendação persuasiva com benefícios relevantes, afirmações ponderadas e uma resposta prática às preocupações.",
  },
  "Stress the contrast between claim and evidence: I wouldn't claim it's PERFECT, but the RESULTS are encouraging.": {
    pt: "Enfatize o contraste entre afirmação e evidência: I wouldn't claim it's PERFECT, but the RESULTS are encouraging.",
  },
  "Recommend a change at work, school, or in your community. Present its strongest benefit, acknowledge one concern, and propose a low-risk next step.": {
    pt: "Recomende uma mudança no trabalho, na escola ou na sua comunidade. Apresente o benefício mais forte, reconheça uma preocupação e proponha um próximo passo de baixo risco.",
  },
  "Keep the claim credible: acknowledge the concern, avoid promising certainty, and connect your final recommendation to the evidence with On that basis...": {
    pt: "Mantenha a afirmação confiável: reconheça a preocupação, evite prometer certeza e conecte a recomendação final às evidências com On that basis...",
  },
  "How does Owen make the proposal less risky?": { pt: "Como Owen torna a proposta menos arriscada?" },
  "He suggests a limited pilot with overlapping hours and an evaluation": {
    pt: "Ele sugere um projeto-piloto limitado, com horários sobrepostos e uma avaliação",
  },
  "He promises that flexible hours will solve every problem": {
    pt: "Ele promete que horários flexíveis resolverão todos os problemas",
  },
  "He removes all communication requirements": { pt: "Ele elimina todos os requisitos de comunicação" },
  "What is Owen's strongest argument for flexible hours?": {
    pt: "Qual é o argumento mais forte de Owen a favor de horários flexíveis?",
  },
  "They could extend customer coverage without adding staff": {
    pt: "Eles poderiam ampliar o horário de atendimento sem aumentar a equipe",
  },
  "They would eliminate the need for customer support": {
    pt: "Eles eliminariam a necessidade de atendimento ao cliente",
  },
  "They would reduce every employee's working hours": {
    pt: "Eles reduziriam a jornada de todos os funcionários",
  },
  "How does Owen respond to the communication concern?": {
    pt: "Como Owen responde à preocupação com a comunicação?",
  },
  "He proposes a daily two-hour overlap": { pt: "Ele propõe duas horas diárias de sobreposição" },
  "He says communication does not matter": { pt: "Ele diz que a comunicação não importa" },
  "He recommends hiring another manager": { pt: "Ele recomenda contratar outro gerente" },
  /* b2-project-management */
  "Lesson 61 — Keeping a Project on Track": { pt: "Lição 61 — Mantendo um projeto no rumo certo" },
  "Scope, deadlines, dependencies, and risks": { pt: "Escopo, prazos, dependências e riscos" },
  "Give a concise project update that clarifies scope, dependencies, schedule pressure, and the action needed to reduce risk.": {
    pt: "Dar uma atualização concisa de projeto que esclareça escopo, dependências, pressão sobre o cronograma e a ação necessária para reduzir o risco.",
  },
  "Stress the project constraint and the response: The DEADLINE is fixed, so we need to REDUCE the scope.": {
    pt: "Enfatize a restrição do projeto e a resposta: The DEADLINE is fixed, so we need to REDUCE the scope.",
  },
  "Give an update on a real or imagined project. Explain one dependency, identify a schedule risk, and recommend how to adjust the scope or plan.": {
    pt: "Dê uma atualização sobre um projeto real ou imaginário. Explique uma dependência, identifique um risco para o cronograma e recomende como ajustar o escopo ou o plano.",
  },
  "Name the constraint clearly, connect the dependency to its impact, and finish with an owner, scope decision, or contingency action.": {
    pt: "Diga a restrição com clareza, conecte a dependência ao impacto e termine com um responsável, uma decisão de escopo ou uma ação de contingência.",
  },
  "What do Leah and Davi decide about the dashboard?": { pt: "O que Leah e Davi decidem sobre o painel?" },
  "They move it to a later release to protect the deadline": {
    pt: "Eles o transferem para uma versão posterior para proteger o prazo",
  },
  "They add it immediately and cancel testing": { pt: "Eles o acrescentam imediatamente e cancelam os testes" },
  "They replace it with a different research project": {
    pt: "Eles o substituem por um projeto de pesquisa diferente",
  },
  "What must happen before the dashboard can be designed?": {
    pt: "O que precisa acontecer antes que o painel possa ser desenvolvido?",
  },
  "The research must be completed": { pt: "A pesquisa precisa ser concluída" },
  "The release date must be announced": { pt: "A data de lançamento precisa ser anunciada" },
  "The testing team must hire a manager": { pt: "A equipe de testes precisa contratar um gerente" },
  "What contingency does Davi add?": { pt: "Que margem para imprevistos Davi acrescenta?" },
  "Two extra days for testing": { pt: "Dois dias extras para testes" },
  "Two additional designers": { pt: "Dois designers adicionais" },
  "A second reporting dashboard": { pt: "Um segundo painel de relatórios" },
  /* b2-feedback-leadership */
  "Lesson 62 — Feedback and Expectations": { pt: "Lição 62 — Feedback e expectativas" },
  "Giving balanced feedback and setting expectations": { pt: "Feedback equilibrado e definição de expectativas" },
  "Give specific, balanced feedback, explain its impact, and agree on a clear standard and follow-up action.": {
    pt: "Dar feedback específico e equilibrado, explicar seu impacto e combinar um padrão claro e uma ação de acompanhamento.",
  },
  "Keep the praise warm and the expectation firm: Your analysis was THOROUGH. Next time, send it by THURSDAY.": {
    pt: "Mantenha o elogio acolhedor e a expectativa firme: Your analysis was THOROUGH. Next time, send it by THURSDAY.",
  },
  "Give feedback on a piece of work. Name one specific strength, describe one behaviour and its impact, then set an expectation and offer useful support.": {
    pt: "Dê feedback sobre um trabalho. Aponte um ponto forte específico, descreva um comportamento e seu impacto, depois defina uma expectativa e ofereça apoio útil.",
  },
  "Base the feedback on something observable, connect it to its impact, and make the next expectation concrete with a deadline or follow-up.": {
    pt: "Baseie o feedback em algo observável, conecte-o ao impacto e torne a próxima expectativa concreta com um prazo ou acompanhamento.",
  },
  "What feedback does Sofia give Malik?": { pt: "Que feedback Sofia dá a Malik?" },
  "His analysis was strong, but he needs to communicate delays earlier": {
    pt: "A análise dele foi boa, mas ele precisa comunicar os atrasos mais cedo",
  },
  "His report contained no useful analysis": { pt: "O relatório dele não continha nenhuma análise útil" },
  "He should stop working with the finance team": { pt: "Ele deveria parar de trabalhar com a equipe financeira" },
  "Why did Malik's update arrive late?": { pt: "Por que a atualização de Malik chegou atrasada?" },
  "He was waiting for figures from finance": { pt: "Ele estava esperando os números do financeiro" },
  "He misunderstood the client's request": { pt: "Ele entendeu mal a solicitação do cliente" },
  "He sent the report to the wrong team": { pt: "Ele enviou o relatório para a equipe errada" },
  "What support do Sofia and Malik agree on?": { pt: "Que apoio Sofia e Malik combinam?" },
  "A check-in on Wednesday": { pt: "Uma conversa na quarta-feira" },
  "A new deadline on Friday": { pt: "Um novo prazo na sexta-feira" },
  "A second person to write the analysis": { pt: "Uma segunda pessoa para escrever a análise" },
  /* b2-data-interpretation */
  "Lesson 63 — Interpreting Data Carefully": { pt: "Lição 63 — Interpretando dados com cuidado" },
  "Interpreting charts, changes, and uncertainty": { pt: "Interpretação de gráficos, mudanças e incerteza" },
  "Interpret a chart by describing its main pattern, making a relevant comparison, and qualifying what the data can support.": {
    pt: "Interpretar um gráfico descrevendo seu padrão principal, fazendo uma comparação relevante e ponderando o que os dados permitem sustentar.",
  },
  "Use contrastive stress for careful comparisons: Sales ROSE overall, but the final MONTH was flat.": {
    pt: "Use ênfase contrastiva em comparações cuidadosas: Sales ROSE overall, but the final MONTH was flat.",
  },
  "Interpret a chart or imagined dataset. Describe the main pattern, compare it with a baseline or group, identify an exception, and state one limitation.": {
    pt: "Interprete um gráfico ou conjunto de dados imaginário. Descreva o padrão principal, compare-o com um valor inicial ou grupo, identifique uma exceção e diga uma limitação.",
  },
  "Separate description from conclusion: report the pattern first, add a precise comparison, then qualify the claim with suggest, exception, or a data limitation.": {
    pt: "Separe descrição de conclusão: apresente primeiro o padrão, acrescente uma comparação precisa e depois pondere a afirmação com suggest, exception ou uma limitação dos dados.",
  },
  "What is Theo's interpretation of the chart?": { pt: "Qual é a interpretação de Theo para o gráfico?" },
  "Participation rose, but the data does not prove the programme caused the increase": {
    pt: "A participação aumentou, mas os dados não provam que o programa causou o aumento",
  },
  "Participation fell equally in every age group": {
    pt: "A participação caiu igualmente em todas as faixas etárias",
  },
  "The programme certainly caused steady growth": { pt: "O programa certamente causou um crescimento constante" },
  "How much did participation increase from the baseline?": {
    pt: "Quanto a participação aumentou em relação ao valor inicial?",
  },
  "Twelve percent": { pt: "Doze por cento" },
  "Twenty percent": { pt: "Vinte por cento" },
  "Two percent": { pt: "Dois por cento" },
  "Which limitation does Theo identify?": { pt: "Que limitação Theo identifica?" },
  "The sample is too small": { pt: "A amostra é pequena demais" },
  "The chart has no baseline": { pt: "O gráfico não tem um valor inicial" },
  "The age groups are not labelled": { pt: "As faixas etárias não estão identificadas" },
  /* a1-errands */
  "Lesson 64 — Running Errands": { pt: "Lição 64 — Fazendo tarefas na rua" },
  "Simple errands and everyday requests": { pt: "Tarefas simples e pedidos do dia a dia" },
  "Make simple requests while buying, finding, paying for, or collecting everyday items.": {
    pt: "Fazer pedidos simples ao comprar, procurar, pagar ou retirar itens do dia a dia.",
  },
  "Keep polite requests smooth: I'd LIKE this one, PLEASE; Can I PAY by CARD?": {
    pt: "Mantenha os pedidos educados fluidos: I'd LIKE this one, PLEASE; Can I PAY by CARD?",
  },
  "Imagine two errands you need to do. Say where you need to go, ask for one item, and ask how you can pay.": {
    pt: "Imagine duas tarefas que você precisa resolver. Diga aonde precisa ir, peça um item e pergunte como pode pagar.",
  },
  "Use I need to go to... for the errand, Where can I find...? for the item, and Can I pay...? at the counter.": {
    pt: "Use I need to go to... para a tarefa, Where can I find...? para o item e Can I pay...? no caixa.",
  },
  "What is Clara doing?": { pt: "O que Clara está fazendo?" },
  "Buying batteries in a shop": { pt: "Comprando pilhas em uma loja" },
  "Collecting medicine at a pharmacy": { pt: "Retirando remédio em uma farmácia" },
  "Returning a bag to a friend": { pt: "Devolvendo uma sacola a uma amiga" },
  "Where are the batteries?": { pt: "Onde estão as pilhas?" },
  "Beside the front counter": { pt: "Ao lado do caixa da frente" },
  "Behind the pharmacy": { pt: "Atrás da farmácia" },
  "Inside a large bag": { pt: "Dentro de uma sacola grande" },
  "How does Clara want to pay?": { pt: "Como Clara quer pagar?" },
  "By card": { pt: "Com cartão" },
  "With a voucher": { pt: "Com um vale" },
  "In cash": { pt: "Em dinheiro" },
  /* a1-feelings */
  "Lesson 65 — Feelings and Needs": { pt: "Lição 65 — Sentimentos e necessidades" },
  "Feelings, preferences, and immediate needs": { pt: "Sentimentos, preferências e necessidades imediatas" },
  "Name a basic feeling, ask how someone feels, and say what would help right now.": {
    pt: "Nomear um sentimento básico, perguntar como alguém se sente e dizer o que ajudaria agora.",
  },
  "Stress the feeling word: I'm a little TIRED; I'm EXCITED about the trip.": {
    pt: "Enfatize a palavra do sentimento: I'm a little TIRED; I'm EXCITED about the trip.",
  },
  "Say how you feel today, explain one reason, and say what you need or would rather do right now.": {
    pt: "Diga como você se sente hoje, explique um motivo e diga do que precisa ou o que prefere fazer agora.",
  },
  "Name the feeling with I feel... or I'm..., add the reason with about or because, then state one need or preference.": {
    pt: "Nomeie o sentimento com I feel... ou I'm..., acrescente o motivo com about ou because e depois diga uma necessidade ou preferência.",
  },
  "Why does Lia talk to Sam?": { pt: "Por que Lia conversa com Sam?" },
  "He seems tired and worried": { pt: "Ele parece cansado e preocupado" },
  "He is excited about a trip": { pt: "Ele está animado com uma viagem" },
  "He wants to change schools": { pt: "Ele quer mudar de escola" },
  "What is Sam worried about?": { pt: "Com o que Sam está preocupado?" },
  "Tomorrow's test": { pt: "A prova de amanhã" },
  "Tonight's dinner": { pt: "O jantar de hoje" },
  "A long journey": { pt: "Uma viagem longa" },
  "What does Sam want to do during the break?": { pt: "O que Sam quer fazer durante a pausa?" },
  "Sit outside for a few minutes": { pt: "Sentar lá fora por alguns minutos" },
  "Go home for the evening": { pt: "Ir para casa e ficar por lá à noite" },
  "Take the test immediately": { pt: "Fazer a prova imediatamente" },
  /* a2-home-problems */
  "Lesson 66 — Problems at Home": { pt: "Lição 66 — Problemas em casa" },
  "Repairs and common problems at home": { pt: "Consertos e problemas comuns em casa" },
  "Report a problem at home, explain how serious it is, and arrange access for a repair.": {
    pt: "Relatar um problema em casa, explicar a gravidade e combinar o acesso para um conserto.",
  },
  "Stress the broken item and the problem: The TAP is LEAKING; the HEATING isn't WORKING.": {
    pt: "Enfatize o item com defeito e o problema: The TAP is LEAKING; the HEATING isn't WORKING.",
  },
  "Call about a problem in your home. Describe what is wrong, say when it started or changed, and arrange a time for someone to visit.": {
    pt: "Ligue por causa de um problema em casa. Descreva o defeito, diga quando começou ou mudou e combine um horário para a visita.",
  },
  "Name the item and exact problem, add when it started or how it changed, then give a clear time when you will be home.": {
    pt: "Nomeie o item e o problema exato, acrescente quando começou ou como mudou e depois dê um horário claro em que você estará em casa.",
  },
  "Why does Marta call Eli?": { pt: "Por que Marta liga para Eli?" },
  "To report a leaking kitchen tap": { pt: "Para informar que a torneira da cozinha está vazando" },
  "To ask for a new kitchen": { pt: "Para pedir uma cozinha nova" },
  "To cancel a repair visit": { pt: "Para cancelar uma visita de conserto" },
  "How has the problem changed?": { pt: "Como o problema mudou?" },
  "It has got worse": { pt: "Ele piorou" },
  "It has stopped completely": { pt: "Ele parou completamente" },
  "It has moved to another room": { pt: "Ele passou para outro cômodo" },
  "When can the repair person come?": { pt: "Quando o profissional pode ir?" },
  "At half past six": { pt: "Às seis e meia" },
  "Before lunchtime": { pt: "Antes da hora do almoço" },
  "Tomorrow morning": { pt: "Amanhã de manhã" },
  /* a2-celebrations */
  "Lesson 67 — Celebrations": { pt: "Lição 67 — Comemorações" },
  "Invitations, birthdays, and celebrations": { pt: "Convites, aniversários e comemorações" },
  "Invite someone to a celebration, respond politely, and ask or offer practical details.": {
    pt: "Convidar alguém para uma comemoração, responder com educação e perguntar ou oferecer detalhes práticos.",
  },
  "Let your voice rise for friendly invitation questions: Would you like to COME? Can I bring ANYTHING?": {
    pt: "Eleve a voz nas perguntas de convite amigáveis: Would you like to COME? Can I bring ANYTHING?",
  },
  "Invite someone to a birthday, graduation, or other celebration. Give the day and time, then answer one question about what the guest can bring.": {
    pt: "Convide alguém para um aniversário, formatura ou outra comemoração. Diga o dia e o horário e depois responda a uma pergunta sobre o que a pessoa pode levar.",
  },
  "Use Would you like to...? for the invitation, a clear time expression, and Can I bring...? or Could you bring...? for the practical detail.": {
    pt: "Use Would you like to...? para o convite, uma expressão de horário clara e Can I bring...? ou Could you bring...? para o detalhe prático.",
  },
  "What are Rosa and Jack arranging?": { pt: "O que Rosa e Jack estão combinando?" },
  "A birthday dinner for Rosa's mother": { pt: "Um jantar de aniversário para a mãe de Rosa" },
  "A graduation lunch for Jack": { pt: "Um almoço de formatura para Jack" },
  "A work meeting on Friday": { pt: "Uma reunião de trabalho na sexta-feira" },
  "What time will they eat?": { pt: "A que horas eles vão comer?" },
  "At half past seven": { pt: "Às sete e meia" },
  "At seven exactly": { pt: "Às sete em ponto" },
  "At half past eight": { pt: "Às oito e meia" },
  "What does Rosa ask Jack to bring?": { pt: "O que Rosa pede para Jack levar?" },
  "A dessert": { pt: "Uma sobremesa" },
  "Some flowers": { pt: "Algumas flores" },
  "A birthday card": { pt: "Um cartão de aniversário" },
  /* a2-social-plans */
  "Lesson 68 — Making Social Plans": { pt: "Lição 68 — Combinando programas" },
  "Hosting, joining, confirming, and declining social events": {
    pt: "Receber, participar, confirmar e recusar eventos sociais",
  },
  "Suggest and confirm a social plan, negotiate a small change, or postpone it politely.": {
    pt: "Sugerir e confirmar um programa, negociar uma pequena mudança ou adiá-lo com educação.",
  },
  "Use friendly intonation to soften changes: Could we make it a little LATER? Let's do it another DAY.": {
    pt: "Use uma entonação amigável para suavizar mudanças: Could we make it a little LATER? Let's do it another DAY.",
  },
  "Arrange a social plan with a friend. Suggest an activity and time, ask for one small change, and finish by confirming what happens next.": {
    pt: "Combine um programa com um amigo. Sugira uma atividade e um horário, peça uma pequena mudança e termine confirmando o que acontece depois.",
  },
  "Open with Are we still on...? or Why don't we...?, negotiate with Could we...?, then confirm with a time plus works for me.": {
    pt: "Comece com Are we still on...? ou Why don't we...?, negocie com Could we...? e depois confirme com um horário seguido de works for me.",
  },
  "What plan do Nina and Ben make?": { pt: "Que plano Nina e Ben fazem?" },
  "They will visit a new café on Saturday": { pt: "Eles vão conhecer um café novo no sábado" },
  "They will cook dinner at the station": { pt: "Eles vão preparar o jantar na estação" },
  "They will postpone the plan until next week": { pt: "Eles vão adiar o plano até a próxima semana" },
  "What time will Nina book the table for?": { pt: "Para que horas Nina vai reservar a mesa?" },
  "Eight o'clock": { pt: "Oito horas" },
  "Seven o'clock": { pt: "Sete horas" },
  Lunchtime: { pt: "Hora do almoço" },
  "When will Ben report any change?": { pt: "Quando Ben vai avisar sobre alguma mudança?" },
  "By lunchtime": { pt: "Até a hora do almoço" },
  "At the station": { pt: "Na estação" },
  "After the café closes": { pt: "Depois que o café fechar" },
  /* b1-cultural-differences */
  "Lesson 69 — Talking About Cultural Differences": {
    pt: "Lição 69 — Falando sobre diferenças culturais",
  },
  "Comparing customs without overgeneralizing": {
    pt: "Comparar costumes sem generalizar demais",
  },
  "Compare familiar customs, describe personal experience, and avoid presenting cultural tendencies as universal facts.": {
    pt: "Comparar costumes conhecidos, descrever experiências pessoais e evitar apresentar tendências culturais como fatos universais.",
  },
  "Stress the qualifier that keeps a comparison careful: In MY experience; SOME people tend to...": {
    pt: "Enfatize a expressão que torna a comparação cuidadosa: In MY experience; SOME people tend to...",
  },
  "Compare one custom you have experienced in two families, workplaces, cities, or countries. Describe a difference and a similarity without saying that everyone behaves the same way.": {
    pt: "Compare um costume que você vivenciou em duas famílias, locais de trabalho, cidades ou países. Descreva uma diferença e uma semelhança sem dizer que todos se comportam da mesma forma.",
  },
  "Frame the comparison with In my experience or One difference I noticed, soften tendencies with some or tend to, and finish with a similarity or exception.": {
    pt: "Apresente a comparação com In my experience ou One difference I noticed, suavize as tendências com some ou tend to e termine com uma semelhança ou exceção.",
  },
  "How does André describe his experience in Helsinki?": {
    pt: "Como André descreve sua experiência em Helsinque?",
  },
  "He notices differences but avoids treating them as rules about everyone": {
    pt: "Ele percebe diferenças, mas evita tratá-las como regras sobre todas as pessoas",
  },
  "He believes people everywhere behave in exactly the same way": {
    pt: "Ele acredita que as pessoas se comportam exatamente da mesma forma em todo lugar",
  },
  "He has decided that workplace customs are impossible to understand": {
    pt: "Ele decidiu que os costumes no trabalho são impossíveis de entender",
  },
  "What difference has André noticed at work?": {
    pt: "Que diferença André percebeu no trabalho?",
  },
  "Greetings are quieter and some people separate work from family life": {
    pt: "Os cumprimentos são mais discretos e algumas pessoas separam o trabalho da vida familiar",
  },
  "Everyone arrives late and talks about family all day": {
    pt: "Todos chegam atrasados e falam sobre a família o dia inteiro",
  },
  "Colleagues never greet one another": { pt: "Os colegas nunca se cumprimentam" },
  "What does André do when he is unsure about politeness?": {
    pt: "O que André faz quando não tem certeza sobre o que é educado?",
  },
  "He asks instead of assuming": { pt: "Ele pergunta em vez de presumir" },
  "He copies the first person he sees": { pt: "Ele imita a primeira pessoa que vê" },
  "He avoids speaking to anyone": { pt: "Ele evita falar com qualquer pessoa" },
  /* b1-community-services */
  "Lesson 70 — Asking for Community Support": {
    pt: "Lição 70 — Pedindo apoio a serviços da comunidade",
  },
  "Public services, local issues, and asking for support": {
    pt: "Serviços públicos, problemas locais e pedidos de apoio",
  },
  "Report a local problem to the appropriate service, provide useful details, and ask what action will happen next.": {
    pt: "Informar um problema local ao serviço adequado, fornecer detalhes úteis e perguntar qual será a próxima ação.",
  },
  "Stress the service problem and location: The STREETLIGHT is OUT near the BUS STOP.": {
    pt: "Enfatize o problema e o local: The STREETLIGHT is OUT near the BUS STOP.",
  },
  "Report a real or imagined issue to a community service. Give its exact location and duration, explain its impact, and ask for a reference number or update.": {
    pt: "Informe um problema real ou imaginário a um serviço da comunidade. Dê a localização exata e a duração, explique o impacto e peça um número de protocolo ou uma atualização.",
  },
  "Start with I'm calling to report..., locate the issue with a street and landmark, explain why it matters, then ask when you should expect an update.": {
    pt: "Comece com I'm calling to report..., localize o problema com uma rua e um ponto de referência, explique por que ele importa e depois pergunte quando deve esperar uma atualização.",
  },
  "Why does Camila contact city services?": {
    pt: "Por que Camila entra em contato com os serviços municipais?",
  },
  "To report a streetlight that is creating a safety problem": {
    pt: "Para informar sobre um poste apagado que está criando um problema de segurança",
  },
  "To apply for a job in the lighting department": {
    pt: "Para se candidatar a um emprego no departamento de iluminação",
  },
  "To change the location of a bus stop": { pt: "Para mudar a localização de um ponto de ônibus" },
  "Where is the broken streetlight?": { pt: "Onde fica o poste de iluminação com defeito?" },
  "On Pine Street opposite the bus stop": {
    pt: "Na Pine Street, em frente ao ponto de ônibus",
  },
  "Inside the city services office": { pt: "Dentro do escritório de serviços municipais" },
  "Behind Camila's workplace": { pt: "Atrás do local de trabalho de Camila" },
  "When should the light be inspected?": { pt: "Quando o poste deve ser vistoriado?" },
  "Within two working days": { pt: "Em até dois dias úteis" },
  "In three weeks": { pt: "Em três semanas" },
  "Before the call ends": { pt: "Antes de a ligação terminar" },
  /* b1-relationships-boundaries */
  "Lesson 71 — Expectations and Boundaries": {
    pt: "Lição 71 — Expectativas e limites",
  },
  "Expectations, boundaries, and respectful disagreement": {
    pt: "Expectativas, limites e discordância respeitosa",
  },
  "State a personal boundary, acknowledge another person's needs, and negotiate a practical agreement without escalating conflict.": {
    pt: "Expressar um limite pessoal, reconhecer as necessidades de outra pessoa e negociar um acordo prático sem aumentar o conflito.",
  },
  "Keep boundary statements calm and firm: I NEED some QUIET time after WORK.": {
    pt: "Mantenha as afirmações de limite calmas e firmes: I NEED some QUIET time after WORK.",
  },
  "Describe a small conflict between friends, relatives, colleagues, or housemates. State one need, acknowledge the other person's view, and propose an agreement with a condition.": {
    pt: "Descreva um pequeno conflito entre amigos, parentes, colegas ou pessoas que moram juntas. Expresse uma necessidade, reconheça a visão da outra pessoa e proponha um acordo com uma condição.",
  },
  "Open without blame, use I need or I'm not comfortable for the boundary, acknowledge the other view, and propose Could we agree to...? plus a clear condition.": {
    pt: "Comece sem culpar, use I need ou I'm not comfortable para o limite, reconheça a outra visão e proponha Could we agree to...? com uma condição clara.",
  },
  "What agreement do Jordan and Rafa make?": {
    pt: "Que acordo Jordan e Rafa fazem?",
  },
  "They will check with each other before weekday visitors and review the plan": {
    pt: "Eles vão consultar um ao outro antes de receber visitas durante a semana e reavaliar o plano",
  },
  "They will never invite friends to their home again": {
    pt: "Eles nunca mais vão convidar amigos para casa",
  },
  "They will move to different homes next week": {
    pt: "Eles vão se mudar para casas diferentes na semana que vem",
  },
  "Why do unexpected visits bother Jordan?": {
    pt: "Por que visitas inesperadas incomodam Jordan?",
  },
  "Jordan needs quiet time after work": { pt: "Jordan precisa de silêncio depois do trabalho" },
  "Jordan dislikes all of Rafa's friends": { pt: "Jordan não gosta de nenhum amigo de Rafa" },
  "Jordan works every weekend": { pt: "Jordan trabalha todo fim de semana" },
  "When can their arrangement be more flexible?": {
    pt: "Quando o acordo deles pode ser mais flexível?",
  },
  "On weekends": { pt: "Nos fins de semana" },
  "During weekday evenings": { pt: "Durante as noites de dias úteis" },
  "Only next year": { pt: "Somente no ano que vem" },
  /* b2-ethical-dilemmas */
  "Lesson 72 — Weighing an Ethical Dilemma": {
    pt: "Lição 72 — Avaliando um dilema ético",
  },
  "Weighing principles and practical consequences": {
    pt: "Avaliar princípios e consequências práticas",
  },
  "Analyse an ethical dilemma by identifying competing duties, affected groups, likely consequences, and a defensible course of action.": {
    pt: "Analisar um dilema ético identificando deveres concorrentes, grupos afetados, consequências prováveis e uma linha de ação defensável.",
  },
  "Use contrastive stress for competing duties: We should protect PRIVACY, but we also owe the public TRANSPARENCY.": {
    pt: "Use ênfase contrastiva para deveres concorrentes: We should protect PRIVACY, but we also owe the public TRANSPARENCY.",
  },
  "Analyse an ethical choice at work, in technology, health, education, or public life. Name two competing duties, identify who could be harmed, and recommend a safeguard or compromise.": {
    pt: "Analise uma escolha ética no trabalho, na tecnologia, na saúde, na educação ou na vida pública. Nomeie dois deveres concorrentes, identifique quem pode ser prejudicado e recomende uma medida de proteção ou um meio-termo.",
  },
  "Set up the tension with We have a duty to... and At the same time..., separate what is legal from what is fair, then justify your choice with a consequence and safeguard.": {
    pt: "Apresente a tensão com We have a duty to... e At the same time..., separe o que é legal do que é justo e depois justifique sua escolha com uma consequência e uma medida de proteção.",
  },
  "What compromise do Imani and Noah consider?": {
    pt: "Que meio-termo Imani e Noah consideram?",
  },
  "Publish district totals while restricting access to detailed data": {
    pt: "Publicar totais por distrito e restringir o acesso aos dados detalhados",
  },
  "Publish every participant's address without restrictions": {
    pt: "Publicar o endereço de cada participante sem restrições",
  },
  "Destroy the study and provide no public information": {
    pt: "Destruir o estudo e não fornecer nenhuma informação pública",
  },
  "What public benefit could the data provide?": {
    pt: "Que benefício público os dados poderiam proporcionar?",
  },
  "It could help neighbourhood clinics prepare": {
    pt: "Eles poderiam ajudar as clínicas dos bairros a se preparar",
  },
  "It could replace all local health services": {
    pt: "Eles poderiam substituir todos os serviços locais de saúde",
  },
  "It could guarantee that no outbreak happens again": {
    pt: "Eles poderiam garantir que nenhum surto aconteça novamente",
  },
  "What harm does Noah want to prevent?": {
    pt: "Que dano Noah quer evitar?",
  },
  "Individuals being exposed through detailed addresses": {
    pt: "A exposição de indivíduos por meio de endereços detalhados",
  },
  "Researchers comparing totals between districts": {
    pt: "Pesquisadores comparando totais entre distritos",
  },
  "Clinics receiving public information": {
    pt: "Clínicas recebendo informações públicas",
  },
  /* b2-remote-work */
  "Lesson 73 — Making Remote Work Work": {
    pt: "Lição 73 — Fazendo o trabalho remoto funcionar",
  },
  "Collaboration, autonomy, and communication trade-offs": {
    pt: "Colaboração, autonomia e concessões na comunicação",
  },
  "Evaluate a remote-work arrangement, balance autonomy with coordination needs, and propose explicit communication practices.": {
    pt: "Avaliar um acordo de trabalho remoto, equilibrar a autonomia com as necessidades de coordenação e propor práticas explícitas de comunicação.",
  },
  "Contrast flexibility with coordination: People need AUTONOMY, but the team still needs OVERLAP.": {
    pt: "Contraste flexibilidade com coordenação: People need AUTONOMY, but the team still needs OVERLAP.",
  },
  "Evaluate a remote or hybrid arrangement you know or can imagine. Explain one benefit and one coordination risk, then propose communication rules and a review point.": {
    pt: "Avalie um acordo remoto ou híbrido que você conheça ou possa imaginar. Explique um benefício e um risco de coordenação e depois proponha regras de comunicação e um momento de avaliação.",
  },
  "State the trade-off with gives people... but can make..., distinguish meetings from written updates, and finish with a measurable trial or review.": {
    pt: "Apresente a concessão com gives people... but can make..., diferencie reuniões de atualizações por escrito e termine com um teste ou uma avaliação mensurável.",
  },
  "What remote-work arrangement do Priya and Lucas propose?": {
    pt: "Que acordo de trabalho remoto Priya e Lucas propõem?",
  },
  "Shared collaboration hours, written decisions, and a six-week review": {
    pt: "Horas de colaboração em comum, decisões por escrito e uma avaliação após seis semanas",
  },
  "A return to the office every day with no written updates": {
    pt: "Um retorno diário ao escritório sem atualizações por escrito",
  },
  "No shared hours and no communication expectations": {
    pt: "Nenhuma hora em comum e nenhuma expectativa de comunicação",
  },
  "Why does Lucas reject a daily meeting for every update?": {
    pt: "Por que Lucas rejeita uma reunião diária para cada atualização?",
  },
  "Not every update requires real-time discussion": {
    pt: "Nem toda atualização exige uma discussão em tempo real",
  },
  "The team is not allowed to hold online meetings": {
    pt: "A equipe não tem permissão para realizar reuniões on-line",
  },
  "Managers already know every decision": {
    pt: "Os gestores já conhecem todas as decisões",
  },
  "What should managers evaluate instead of online presence?": {
    pt: "O que os gestores devem avaliar em vez da presença on-line?",
  },
  Outcomes: { pt: "Resultados" },
  "Camera backgrounds": { pt: "Planos de fundo da câmera" },
  "The number of messages sent": { pt: "O número de mensagens enviadas" },
  /* b2-media-bias */
  "Lesson 74 — Reading Beyond the Frame": {
    pt: "Lição 74 — Lendo além do enquadramento",
  },
  "Framing, evidence selection, and source reliability": {
    pt: "Enquadramento, seleção de evidências e confiabilidade das fontes",
  },
  "Compare how two reports frame the same event, test their claims against the evidence, and give a neutral summary.": {
    pt: "Comparar como duas reportagens enquadram o mesmo acontecimento, confrontar suas afirmações com as evidências e produzir um resumo neutro.",
  },
  "Use contrastive stress to expose framing choices: The plan was DELAYED, not ABANDONED.": {
    pt: "Use a ênfase contrastiva para revelar escolhas de enquadramento: The plan was DELAYED, not ABANDONED.",
  },
  "What do Livia and Omar conclude about the transport pilot?": {
    pt: "O que Livia e Omar concluem sobre o projeto-piloto de transporte?",
  },
  "It improved the service but cost more than planned": {
    pt: "Ele melhorou o serviço, mas custou mais que o planejado",
  },
  "It failed in every measured area": {
    pt: "Ele fracassou em todas as áreas avaliadas",
  },
  "It stayed under budget without changing journey times": {
    pt: "Ele ficou abaixo do orçamento sem alterar o tempo das viagens",
  },
  "What does the first report leave out?": {
    pt: "O que a primeira reportagem deixa de fora?",
  },
  "The improvement in journey times": {
    pt: "A redução no tempo das viagens",
  },
  "The name of the transport service": {
    pt: "O nome do serviço de transporte",
  },
  "The fact that the pilot had a budget": {
    pt: "O fato de que o projeto-piloto tinha um orçamento",
  },
  "Why do they treat the second report's main source cautiously?": {
    pt: "Por que eles tratam com cautela a principal fonte da segunda reportagem?",
  },
  "The source helped design the pilot": {
    pt: "A fonte ajudou a projetar o piloto",
  },
  "The source refuses to cite any figures": {
    pt: "A fonte se recusa a citar qualquer número",
  },
  "The source works for the first newspaper": {
    pt: "A fonte trabalha para o primeiro jornal",
  },
  "Compare two headlines or accounts of the same event. Identify one framing choice or omitted detail, evaluate the source, and give a more neutral summary.": {
    pt: "Compare duas manchetes ou versões do mesmo acontecimento. Identifique uma escolha de enquadramento ou um detalhe omitido, avalie a fonte e produza um resumo mais neutro.",
  },
  "Name the frame with frames... as..., identify what the report leaves out, then limit your conclusion to what the evidence supports.": {
    pt: "Nomeie o enquadramento com frames... as..., identifique o que a reportagem deixa de fora e limite sua conclusão ao que as evidências sustentam.",
  },
  /* b2-uncertainty */
  "Lesson 75 — Reasoning Under Uncertainty": {
    pt: "Lição 75 — Raciocinando sob incerteza",
  },
  "Speculation, probability, and calibrated confidence": {
    pt: "Especulação, probabilidade e grau de confiança calibrado",
  },
  "Discuss competing explanations with calibrated confidence, state what could change your view, and avoid presenting speculation as fact.": {
    pt: "Discutir explicações concorrentes com um grau de confiança calibrado, dizer o que poderia mudar sua avaliação e evitar apresentar especulação como fato.",
  },
  "Stress probability markers to calibrate a claim: it's LIKELY, but not CERTAIN.": {
    pt: "Enfatize os marcadores de probabilidade para calibrar uma afirmação: it's LIKELY, but not CERTAIN.",
  },
  "How do Mei and Dan assess the possible launch delay?": {
    pt: "Como Mei e Dan avaliam o possível atraso no lançamento?",
  },
  "It is moderately likely, but key evidence is still missing": {
    pt: "É moderadamente provável, mas ainda faltam evidências importantes",
  },
  "It is certain because the supplier admitted responsibility": {
    pt: "É certo porque o fornecedor assumiu a responsabilidade",
  },
  "It is impossible because internal testing is complete": {
    pt: "É impossível porque os testes internos terminaram",
  },
  "What alternative explanation does Dan keep open?": {
    pt: "Que explicação alternativa Dan mantém em aberto?",
  },
  "A problem with internal testing": {
    pt: "Um problema nos testes internos",
  },
  "A change in the product's price": {
    pt: "Uma mudança no preço do produto",
  },
  "A mistake in the marketing campaign": {
    pt: "Um erro na campanha de marketing",
  },
  "What evidence would increase Dan's confidence?": {
    pt: "Que evidência aumentaria o grau de confiança de Dan?",
  },
  "Final test results and a confirmed delivery date": {
    pt: "Resultados finais dos testes e uma data de entrega confirmada",
  },
  "A larger advertising budget": {
    pt: "Um orçamento de publicidade maior",
  },
  "An informal promise from the launch team": {
    pt: "Uma promessa informal da equipe de lançamento",
  },
  "Assess an uncertain outcome at work, in study, or in daily life. Compare two explanations, state your confidence, and name evidence that would change your view.": {
    pt: "Avalie um resultado incerto no trabalho, nos estudos ou na vida cotidiana. Compare duas explicações, declare seu grau de confiança e cite evidências que mudariam sua avaliação.",
  },
  "Mark uncertainty with likely, plausible, or can't rule out; identify one assumption, then say what new evidence would update your view.": {
    pt: "Marque a incerteza com likely, plausible ou can't rule out; identifique uma suposição e diga que novas evidências atualizariam sua avaliação.",
  },
  /* c1-diplomatic-disagreement */
  "Lesson 76 — Disagreeing with Precision": {
    pt: "Lição 76 — Discordando com precisão",
  },
  "Challenging assumptions with diplomatic precision": {
    pt: "Questionamento de premissas com precisão diplomática",
  },
  "Challenge an assumption precisely while recognising shared goals and proposing a constructive way to test the disagreement.": {
    pt: "Questionar uma premissa com precisão, reconhecendo objetivos comuns e propondo uma forma construtiva de testar a divergência.",
  },
  "Soften the opening, then stress the exact point of disagreement: I see the LOGIC, but not the ASSUMPTION.": {
    pt: "Suavize a abertura e depois enfatize o ponto exato da divergência: I see the LOGIC, but not the ASSUMPTION.",
  },
  "What does Elias propose instead of entering three markets at once?": {
    pt: "O que Elias propõe em vez de entrar em três mercados de uma vez?",
  },
  "Testing one market before expanding to the other two": {
    pt: "Testar um mercado antes de expandir para os outros dois",
  },
  "Abandoning international expansion permanently": {
    pt: "Abandonar permanentemente a expansão internacional",
  },
  "Entering all three markets without customer support": {
    pt: "Entrar nos três mercados sem atendimento ao cliente",
  },
  "Which assumption does Elias challenge?": {
    pt: "Que premissa Elias questiona?",
  },
  "The current support model will scale smoothly": {
    pt: "O modelo atual de atendimento ganhará escala sem dificuldades",
  },
  "Competitors are already in all three markets": {
    pt: "Os concorrentes já estão nos três mercados",
  },
  "The company needs fewer support languages": {
    pt: "A empresa precisa de menos idiomas no atendimento",
  },
  "Where do Rina and Elias still agree?": {
    pt: "Em que Rina e Elias ainda concordam?",
  },
  "The company should expand internationally": {
    pt: "A empresa deve se expandir internacionalmente",
  },
  "No additional support capacity is necessary": {
    pt: "Não é necessária nenhuma capacidade adicional de atendimento",
  },
  "All three markets have identical needs": {
    pt: "Os três mercados têm necessidades idênticas",
  },
  "Respond to a proposal you partly disagree with. Recognise its logic, identify the exact assumption or distinction you challenge, and propose a test or alternative.": {
    pt: "Responda a uma proposta da qual você discorda em parte. Reconheça sua lógica, identifique a premissa ou distinção exata que você questiona e proponha um teste ou alternativa.",
  },
  "Open with shared ground, challenge one named assumption with but or although, and finish with Would you be open to...?": {
    pt: "Comece pelo ponto em comum, questione uma premissa específica com but ou although e termine com Would you be open to...?",
  },
  /* c1-presentations-q-and-a */
  "Lesson 77 — Handling Difficult Questions": {
    pt: "Lição 77 — Lidando com perguntas difíceis",
  },
  "Handling difficult questions after a presentation": {
    pt: "Como lidar com perguntas difíceis após uma apresentação",
  },
  "Answer a challenging presentation question directly, clarify the scope of the evidence, acknowledge limits, and commit to an accurate follow-up.": {
    pt: "Responder diretamente a uma pergunta desafiadora após uma apresentação, esclarecer o alcance das evidências, reconhecer limites e se comprometer com um retorno preciso.",
  },
  "Pause after the direct answer, then signpost the qualification: YES. However, that figure refers SPECIFICALLY to....": {
    pt: "Faça uma pausa após a resposta direta e depois sinalize a ressalva: YES. However, that figure refers SPECIFICALLY to....",
  },
  "How does the presenter handle the question about regional offices?": {
    pt: "Como a apresentadora lida com a pergunta sobre os escritórios regionais?",
  },
  "She limits the claim, admits missing detail, and promises a verified follow-up": {
    pt: "Ela limita a afirmação, admite que falta um detalhe e promete um retorno verificado",
  },
  "She applies the fifteen percent figure to every office without qualification": {
    pt: "Ela aplica o número de quinze por cento a todos os escritórios sem ressalvas",
  },
  "She rejects the question because it was not submitted in advance": {
    pt: "Ela rejeita a pergunta porque não foi enviada com antecedência",
  },
  "What does the fifteen percent figure describe?": {
    pt: "O que o número de quinze por cento descreve?",
  },
  "A first-quarter pilot in two large offices": {
    pt: "Um projeto-piloto do primeiro trimestre em dois escritórios grandes",
  },
  "Every regional office over a full year": {
    pt: "Todos os escritórios regionais ao longo de um ano inteiro",
  },
  "A forecast with no observed data": {
    pt: "Uma previsão sem dados observados",
  },
  "What follow-up does the presenter promise?": {
    pt: "Que retorno a apresentadora promete?",
  },
  "A regional estimate with its assumptions": {
    pt: "Uma estimativa regional com suas premissas",
  },
  "A new pilot completed by tomorrow": {
    pt: "Um novo projeto-piloto concluído até amanhã",
  },
  "The names of everyone in the sample": {
    pt: "Os nomes de todas as pessoas da amostra",
  },
  "Answer a difficult question about a proposal or result. Give the direct answer first, define the evidence's scope, acknowledge one limitation, and offer a precise follow-up if needed.": {
    pt: "Responda a uma pergunta difícil sobre uma proposta ou resultado. Dê primeiro a resposta direta, defina o alcance das evidências, reconheça uma limitação e ofereça um retorno preciso se necessário.",
  },
  "Lead with The short answer is..., clarify what the figure refers to, and replace any guess with I'd rather verify that than speculate.": {
    pt: "Comece com The short answer is..., esclareça a que o número se refere e substitua qualquer palpite por I'd rather verify that than speculate.",
  },
  /* c1-stakeholders */
  "Lesson 78 — Aligning Competing Priorities": {
    pt: "Lição 78 — Alinhando prioridades concorrentes",
  },
  "Aligning stakeholders with conflicting priorities": {
    pt: "Alinhamento de partes interessadas com prioridades conflitantes",
  },
  "Surface the constraints behind conflicting stakeholder positions, protect shared outcomes, and negotiate a phased decision with explicit unresolved points.": {
    pt: "Revelar as restrições por trás de posições conflitantes das partes interessadas, preservar resultados comuns e negociar uma decisão em etapas com pontos pendentes explícitos.",
  },
  "Use parallel stress to make a trade-off audible: protect RELIABILITY without delaying LEARNING.": {
    pt: "Use a ênfase paralela para tornar clara a escolha envolvida: protect RELIABILITY without delaying LEARNING.",
  },
  "What compromise do the stakeholders reach?": {
    pt: "A que acordo as partes interessadas chegam?",
  },
  "A limited launch with safeguards and a two-week review": {
    pt: "Um lançamento limitado com salvaguardas e uma avaliação após duas semanas",
  },
  "A full launch next month without additional controls": {
    pt: "Um lançamento completo no mês que vem sem controles adicionais",
  },
  "A permanent delay with no customer testing": {
    pt: "Um adiamento permanente sem testes com clientes",
  },
  "What is Operations' non-negotiable condition?": {
    pt: "Qual é a condição inegociável de Operações?",
  },
  "The existing service must not be interrupted": {
    pt: "O serviço existente não pode ser interrompido",
  },
  "The first phase must include every customer": {
    pt: "A primeira etapa deve incluir todos os clientes",
  },
  "Product must cancel the launch completely": {
    pt: "Produto deve cancelar o lançamento por completo",
  },
  "Why does Product resist waiting a full quarter?": {
    pt: "Por que Produto resiste a esperar um trimestre inteiro?",
  },
  "It wants customer learning before the busiest season": {
    pt: "A equipe quer aprender com os clientes antes da época de maior movimento",
  },
  "It has already promised a full launch to Operations": {
    pt: "A equipe já prometeu um lançamento completo a Operações",
  },
  "It believes reliability testing has no value": {
    pt: "A equipe acredita que os testes de confiabilidade não têm valor",
  },
  "Mediate a disagreement between two groups with different priorities. Name each constraint, identify a non-negotiable, and propose a phased decision that preserves the shared outcome.": {
    pt: "Faça a mediação de uma divergência entre dois grupos com prioridades diferentes. Nomeie cada restrição, identifique um ponto inegociável e proponha uma decisão em etapas que preserve o resultado comum.",
  },
  "Separate outcome from sequence, ask what would have to be true for support, and document the safeguard, phase, and review point.": {
    pt: "Separe resultado de sequência, pergunte o que precisaria ser verdade para haver apoio e documente a salvaguarda, a etapa e o momento de avaliação.",
  },
  /* b2-proposals */
  "Lesson 79 — Making a Strong Proposal": {
    pt: "Lição 79 — Elaborando uma proposta sólida",
  },
  "Presenting and defending a structured proposal": {
    pt: "Apresentação e defesa de uma proposta estruturada",
  },
  "Present a structured proposal with a clear rationale, practical safeguards, and a specific decision request.": {
    pt: "Apresentar uma proposta estruturada com uma justificativa clara, salvaguardas práticas e um pedido de decisão específico.",
  },
  "Use signposting pauses to reveal the structure: the GOAL / the EVIDENCE / and the SAFEGUARD.": {
    pt: "Use pausas de sinalização para revelar a estrutura: the GOAL / the EVIDENCE / and the SAFEGUARD.",
  },
  "What is Nora proposing?": {
    pt: "O que Nora está propondo?",
  },
  "A limited six-week trial of a different support schedule": {
    pt: "Um teste limitado de seis semanas com um horário de atendimento diferente",
  },
  "A permanent schedule change for the entire company": {
    pt: "Uma mudança permanente de horário para toda a empresa",
  },
  "A reduction in support hours for urgent requests": {
    pt: "Uma redução no horário de atendimento a solicitações urgentes",
  },
  "What evidence supports the proposal?": {
    pt: "Que evidência sustenta a proposta?",
  },
  "Many urgent requests arrive after the team finishes": {
    pt: "Muitas solicitações urgentes chegam depois que a equipe encerra o expediente",
  },
  "Customer satisfaction has already doubled": {
    pt: "A satisfação dos clientes já dobrou",
  },
  "Every employee has requested additional hours": {
    pt: "Todos os funcionários solicitaram horas adicionais",
  },
  "How does Nora address the overtime risk?": {
    pt: "Como Nora lida com o risco de horas extras?",
  },
  "She limits the trial to volunteers and fifty customers": {
    pt: "Ela limita o teste a voluntários e cinquenta clientes",
  },
  "She removes overtime from the review criteria": {
    pt: "Ela retira as horas extras dos critérios de avaliação",
  },
  "She delays the trial until workload data is unavailable": {
    pt: "Ela adia o teste até que os dados de carga de trabalho estejam indisponíveis",
  },
  "Present a proposal for a change at work, in study, or in your community. Structure the idea, support it with evidence, name one constraint and safeguard, and ask for a specific decision.": {
    pt: "Apresente uma proposta de mudança no trabalho, nos estudos ou na sua comunidade. Estruture a ideia, sustente-a com evidências, mencione uma restrição e uma salvaguarda e peça uma decisão específica.",
  },
  "Signpost the parts, connect the expected benefit to evidence, address one risk with To reduce that risk..., and finish with I'm asking for....": {
    pt: "Sinalize as partes, conecte o benefício esperado às evidências, trate um risco com To reduce that risk... e termine com I'm asking for....",
  },
  /* b2-professional-disagreement */
  "Lesson 80 — Disagreeing and Moving Forward": {
    pt: "Lição 80 — Discordando e avançando",
  },
  "Disagreeing clearly while preserving cooperation": {
    pt: "Discordância clara com preservação da cooperação",
  },
  "Express a professional disagreement clearly, locate the source of the difference, and agree on evidence that can move the discussion forward.": {
    pt: "Expressar uma divergência profissional com clareza, localizar a origem da diferença e chegar a um acordo sobre evidências que possam fazer a discussão avançar.",
  },
  "Keep the acknowledgement calm, then stress the contrast: I agree with the GOAL, but not the APPROACH.": {
    pt: "Mantenha o reconhecimento em tom calmo e depois enfatize o contraste: I agree with the GOAL, but not the APPROACH.",
  },
  "How do Amira and Jonas move their disagreement forward?": {
    pt: "Como Amira e Jonas fazem a divergência avançar?",
  },
  "They agree on criteria for comparing the suppliers": {
    pt: "Eles concordam quanto aos critérios para comparar os fornecedores",
  },
  "They cancel both supplier contracts immediately": {
    pt: "Eles cancelam imediatamente os contratos dos dois fornecedores",
  },
  "They decide that delivery time no longer matters": {
    pt: "Eles decidem que o prazo de entrega não importa mais",
  },
  "Why does Amira interpret the delay evidence differently?": {
    pt: "Por que Amira interpreta as evidências dos atrasos de outra forma?",
  },
  "Most delays followed late changes from their own team": {
    pt: "A maioria dos atrasos ocorreu depois de mudanças tardias da própria equipe",
  },
  "The supplier delivered every order on time": {
    pt: "O fornecedor entregou todos os pedidos no prazo",
  },
  "The quarterly records do not include delivery dates": {
    pt: "Os registros trimestrais não incluem datas de entrega",
  },
  "What is Amira mainly concerned about?": {
    pt: "Qual é a principal preocupação de Amira?",
  },
  "Reliability during a supplier transition": {
    pt: "A confiabilidade durante a transição de fornecedor",
  },
  "The colour of the supplier's packaging": {
    pt: "A cor da embalagem do fornecedor",
  },
  "Jonas presenting the comparison next week": {
    pt: "Jonas apresentar a comparação na semana que vem",
  },
  "Respond to a professional decision you disagree with. Acknowledge the shared objective, explain exactly where your interpretation differs, and propose common criteria or evidence for the next decision.": {
    pt: "Responda a uma decisão profissional da qual você discorda. Reconheça o objetivo comum, explique exatamente onde sua interpretação diverge e proponha critérios ou evidências comuns para a próxima decisão.",
  },
  "Separate the objective from the approach, ask how the conclusion was reached, and summarise the exact difference before proposing shared criteria.": {
    pt: "Separe o objetivo da abordagem, pergunte como se chegou à conclusão e resuma a diferença exata antes de propor critérios comuns.",
  },
  /* b2-root-causes */
  "Lesson 81 — Finding the Root Cause": {
    pt: "Lição 81 — Encontrando a causa-raiz",
  },
  "Diagnosing problems beyond immediate symptoms": {
    pt: "Diagnóstico de problemas além dos sintomas imediatos",
  },
  "Distinguish triggers, contributing factors, and root causes in order to recommend a lasting response to a recurring problem.": {
    pt: "Distinguir gatilhos, fatores contribuintes e causas-raiz para recomendar uma resposta duradoura a um problema recorrente.",
  },
  "Stress the diagnostic contrast: that explains WHEN it failed, not WHY it was possible.": {
    pt: "Enfatize o contraste do diagnóstico: that explains WHEN it failed, not WHY it was possible.",
  },
  "What do Priya and Marco identify as the underlying issue?": {
    pt: "O que Priya e Marco identificam como o problema subjacente?",
  },
  "Unclear ownership of urgent update approvals": {
    pt: "Falta de clareza sobre a responsabilidade pelas aprovações de atualizações urgentes",
  },
  "A website that cannot receive software updates": {
    pt: "Um site que não consegue receber atualizações de software",
  },
  "An engineer who refuses to record incidents": {
    pt: "Um engenheiro que se recusa a registrar incidentes",
  },
  "What pattern suggests that the problem is not isolated?": {
    pt: "Que padrão indica que o problema não é isolado?",
  },
  "Three updates went unreviewed in two months": {
    pt: "Três atualizações ficaram sem revisão em dois meses",
  },
  "The website has been online for three years": {
    pt: "O site está no ar há três anos",
  },
  "Three engineers approved the same update": {
    pt: "Três engenheiros aprovaram a mesma atualização",
  },
  "What lasting fix do they recommend?": {
    pt: "Que solução duradoura eles recomendam?",
  },
  "Naming a backup approver and requiring recorded review": {
    pt: "Nomear um aprovador substituto e exigir uma revisão registrada",
  },
  "Blocking every future software update": {
    pt: "Bloquear todas as futuras atualizações de software",
  },
  "Asking one engineer to work without holidays": {
    pt: "Pedir que um engenheiro trabalhe sem tirar férias",
  },
  "Analyse a recurring problem from work, study, or daily life. Distinguish the visible symptom, immediate trigger, contributing factors, and likely root cause, then recommend a lasting fix.": {
    pt: "Analise um problema recorrente do trabalho, dos estudos ou da vida cotidiana. Distinga o sintoma visível, o gatilho imediato, os fatores contribuintes e a provável causa-raiz e então recomende uma solução duradoura.",
  },
  "Ask what made the failure possible, use appears to be for the diagnosis, and make sure the lasting fix addresses that cause rather than only the symptom.": {
    pt: "Pergunte o que tornou a falha possível, use appears to be no diagnóstico e garanta que a solução duradoura trate essa causa, e não apenas o sintoma.",
  },
  /* b2-competing-views */
  "Lesson 82 — Comparing Competing Views": {
    pt: "Lição 82 — Comparando visões concorrentes",
  },
  "Summarizing and comparing competing positions": {
    pt: "Resumo e comparação de posições concorrentes",
  },
  "Summarise competing positions fairly, expose their assumptions and shared ground, and reach a qualified evidence-based judgement.": {
    pt: "Resumir posições concorrentes de forma justa, revelar suas premissas e pontos em comum e chegar a uma avaliação ponderada e baseada em evidências.",
  },
  "Use balanced stress for fair comparison: supporters point to ACCESS; critics emphasise COST.": {
    pt: "Use ênfase equilibrada para uma comparação justa: supporters point to ACCESS; critics emphasise COST.",
  },
  "What conclusion do Helen and Rafael reach?": {
    pt: "A que conclusão Helen e Rafael chegam?",
  },
  "A longer trial should gather passenger and cost data": {
    pt: "Um teste mais longo deve coletar dados de passageiros e custos",
  },
  "Free weekend buses should begin permanently tomorrow": {
    pt: "Os ônibus gratuitos nos fins de semana devem começar permanentemente amanhã",
  },
  "The city should abandon all public transport trials": {
    pt: "A cidade deve abandonar todos os testes de transporte público",
  },
  "What evidence do supporters use?": {
    pt: "Que evidência os defensores usam?",
  },
  "Passenger numbers rose during a recent trial": {
    pt: "O número de passageiros aumentou durante um teste recente",
  },
  "The city centre eliminated all transport costs": {
    pt: "O centro da cidade eliminou todos os custos de transporte",
  },
  "The trial measured ten years of economic activity": {
    pt: "O teste mediu dez anos de atividade econômica",
  },
  "What is the key unresolved question?": {
    pt: "Qual é a principal questão ainda sem resposta?",
  },
  "Whether increased activity would cover the extra cost": {
    pt: "Se o aumento da atividade cobriria o custo adicional",
  },
  "Whether passengers know where the city centre is": {
    pt: "Se os passageiros sabem onde fica o centro da cidade",
  },
  "Whether both sides want public transport to disappear": {
    pt: "Se os dois lados querem que o transporte público desapareça",
  },
  "Compare two competing views on a public, professional, or everyday issue. Present each side's evidence fairly, identify shared ground and the key disagreement, and give a qualified judgement.": {
    pt: "Compare duas visões concorrentes sobre uma questão pública, profissional ou cotidiana. Apresente as evidências de cada lado de forma justa, identifique pontos em comum e a principal divergência e faça uma avaliação ponderada.",
  },
  "Use Supporters point to... and Critics counter..., name one shared assumption or goal, then qualify your judgement with On balance....": {
    pt: "Use Supporters point to... e Critics counter..., mencione uma premissa ou objetivo comum e depois pondere sua avaliação com On balance....",
  },
  /* c1-crisis-communication */
  "Lesson 83 — Communicating Through a Crisis": {
    pt: "Lição 83 — Comunicando-se durante uma crise",
  },
  "Communicating uncertainty and action under pressure": {
    pt: "Comunicação de incerteza e ação sob pressão",
  },
  "Communicate verified facts, uncertainty, immediate action, and the next update under pressure without minimising harm or encouraging speculation.": {
    pt: "Comunicar fatos verificados, incerteza, ações imediatas e a próxima atualização sob pressão, sem minimizar danos nem incentivar especulações.",
  },
  "Use a firm fall for verified facts and a measured rise for uncertainty: we CAN confirm this; we are still ESTABLISHING that.": {
    pt: "Use uma entonação descendente firme para fatos verificados e uma ascendente moderada para incertezas: we CAN confirm this; we are still ESTABLISHING that.",
  },
  "How does the spokesperson communicate during the incident?": {
    pt: "Como o porta-voz se comunica durante o incidente?",
  },
  "By separating verified facts, unknowns, actions, and update times": {
    pt: "Separando fatos verificados, aspectos desconhecidos, ações e horários de atualização",
  },
  "By claiming the incident is resolved before the review begins": {
    pt: "Afirmando que o incidente foi resolvido antes do início da análise",
  },
  "By refusing to provide any information until every fact is known": {
    pt: "Recusando-se a fornecer qualquer informação até que todos os fatos sejam conhecidos",
  },
  "What remains unknown?": {
    pt: "O que ainda não se sabe?",
  },
  "Whether data was exposed and what caused the interruption": {
    pt: "Se houve exposição de dados e o que causou a interrupção",
  },
  "When the service interruption began": {
    pt: "Quando começou a interrupção do serviço",
  },
  "Which response team is restoring access": {
    pt: "Qual equipe de resposta está restabelecendo o acesso",
  },
  "What precaution has the company taken?": {
    pt: "Que medida de precaução a empresa tomou?",
  },
  "It has suspended password changes": {
    pt: "Ela suspendeu as alterações de senha",
  },
  "It has deleted all customer accounts": {
    pt: "Ela excluiu todas as contas de clientes",
  },
  "It has restored service without testing": {
    pt: "Ela restabeleceu o serviço sem realizar testes",
  },
  "Give a short crisis update about a service, safety, or operational incident. Separate confirmed facts from unknowns, state the immediate action and precaution, and commit to the next update.": {
    pt: "Dê uma breve atualização de crise sobre um incidente de serviço, segurança ou operação. Separe os fatos confirmados dos aspectos desconhecidos, informe a ação imediata e a precaução e comprometa-se com a próxima atualização.",
  },
  "Use We can confirm... only for verified facts, name one unknown with still establishing, decline speculation, and give a specific time for the next update.": {
    pt: "Use We can confirm... apenas para fatos verificados, mencione um aspecto desconhecido com still establishing, recuse-se a especular e informe um horário específico para a próxima atualização.",
  },
  "Complete Lesson 1 — Greetings": { pt: "Complete a Lição 1 — Cumprimentos" },
  "Complete Lesson 2 — Names": { pt: "Complete a Lição 2 — Nomes" },
  "Complete Lesson 3 — Countries and Cities": { pt: "Complete a Lição 3 — Países e cidades" },
  "Complete Lesson 4 — Be": { pt: "Complete a Lição 4 — Verbo be" },
  "Complete Lesson 5 — Jobs": { pt: "Complete a Lição 5 — Trabalhos" },
  "Complete Lesson 6 — Family": { pt: "Complete a Lição 6 — Família" },
  "Complete Lesson 7 — Numbers and Age": { pt: "Complete a Lição 7 — Números e idade" },
  "Complete Lesson 8 — Daily Routine": { pt: "Complete a Lição 8 — Rotina diária" },
  "Complete Lesson 9 — Food": { pt: "Complete a Lição 9 — Comida" },
  "Complete Lesson 10 — Directions": { pt: "Complete a Lição 10 — Direções" },
  "Review Lesson 9 — Food": { pt: "Revise a Lição 9 — Comida" },
  "Review Lesson 8 — Daily Routine": { pt: "Revise a Lição 8 — Rotina diária" },
  "Review Lesson 10 — Directions": { pt: "Revise a Lição 10 — Direções" },
  "Review Lesson 5 — Jobs and help": { pt: "Revise a Lição 5 — Trabalhos e ajuda" },
  "Review Lesson 1 — Greetings": { pt: "Revise a Lição 1 — Cumprimentos" },

  // Study/Review tab (StudyTab, StudyCard, GradeButtons, PerformanceStats,
  // SavedCardsBrowser, SessionSummary) and PronunciationCoach.
  "Again": { pt: "De novo" },
  "Hard": { pt: "Difícil" },
  "Good": { pt: "Bom" },
  "Easy": { pt: "Fácil" },
  "No practice phrases yet": { pt: "Ainda não há frases para praticar" },
  "Start from Home with the first lesson. If you already have a source, bring it in Phrases.": {
    pt: "Comece pela Início, com a primeira lição. Se já tem um material, importe em Frases.",
  },
  "Open Phrases": { pt: "Abrir Frases" },
  "You're all caught up": { pt: "Você está em dia" },
  "Tomorrow you review these phrases. Add more only when you want fresh material.": {
    pt: "Amanhã você revisa essas frases. Adicione mais só quando quiser material novo.",
  },
  "Practice phrase": { pt: "Frase para praticar" },
  "{count} in today's queue": { pt: "{count} na fila de hoje" },
  "Show answer": { pt: "Mostrar resposta" },
  "Listen & repeat": { pt: "Ouvir e repetir" },
  "You've struggled with this one — hear it first, then say it back.": {
    pt: "Você tem tido dificuldade com esta — ouça primeiro, depois repita em voz alta.",
  },
  "Need a hint?": { pt: "Precisa de uma dica?" },
  "Hint": { pt: "Dica" },
  "Replay 0.75×": { pt: "Repetir em 0.75×" },
  "Review complete": { pt: "Revisão concluída" },
  "{count} phrases reviewed today.": { pt: "{count} frases revisadas hoje." },
  "Now": { pt: "Agora" },
  "went well this round": { pt: "foi bem nesta rodada" },
  "Tomorrow": { pt: "Amanhã" },
  "ready for tomorrow": { pt: "prontas para amanhã" },
  "{count} days in a row. Tomorrow you review the next phrases.": {
    pt: "{count} dias seguidos. Amanhã você revisa as próximas frases.",
  },
  "{count} days in a row.": { pt: "{count} dias seguidos." },
  "Nothing due tomorrow yet — the next review arrives right on time.": {
    pt: "Nada para amanhã ainda — a próxima revisão chega na hora certa.",
  },
  "Tomorrow: the phrase from today's mistake is waiting for you.": {
    pt: "Amanhã: a frase do seu erro de hoje te espera.",
  },
  "Tomorrow: {count} phrases are waiting — 1 came from today's mistake.": {
    pt: "Amanhã: {count} frases te esperam — 1 veio do seu erro de hoje.",
  },
  "Tomorrow: {count} phrases are waiting — {mistakes} came from today's mistakes.": {
    pt: "Amanhã: {count} frases te esperam — {mistakes} vieram dos seus erros de hoje.",
  },
  "Tomorrow: 1 phrase is waiting for you.": { pt: "Amanhã: 1 frase te espera." },
  "Tomorrow: {count} phrases are waiting for you.": {
    pt: "Amanhã: {count} frases te esperam.",
  },
  "Performance": { pt: "Desempenho" },
  "Reviews": { pt: "Revisões" },
  "Accuracy": { pt: "Acerto" },
  "Streak": { pt: "Sequência" },
  "You've come back {returns} of {gaps} time within a week of a break.": {
    pt: "Você voltou {returns} de {gaps} vez dentro de uma semana após uma pausa.",
  },
  "You've come back {returns} of {gaps} times within a week of a break.": {
    pt: "Você voltou {returns} de {gaps} vezes dentro de uma semana após uma pausa.",
  },
  "Review activity": { pt: "Atividade de revisão" },
  "Last 14 days · {count} today": { pt: "Últimos 14 dias · {count} hoje" },
  "Error types": { pt: "Tipos de erro" },
  "Accuracy by recurring correction category": { pt: "Acerto por categoria de correção recorrente" },
  "{count} rev": { pt: "{count} rev" },
  "Saved practice phrases": { pt: "Frases salvas" },
  "{count} total": { pt: "{count} no total" },
  "Search phrases": { pt: "Buscar frases" },
  "Practice phrases you save will appear here.": { pt: "As frases que você salvar aparecem aqui." },
  "No phrases match that search.": { pt: "Nenhuma frase corresponde a essa busca." },
  "Loading…": { pt: "Carregando…" },
  "Local storage isn't available in this browser, so studying is disabled.": {
    pt: "O armazenamento local não está disponível neste navegador, então a revisão está desativada.",
  },
  "Reinforcing": { pt: "Reforçando" },
  "{count} remaining": { pt: "{count} restantes" },
  "Exit": { pt: "Sair" },
  "Light session": { pt: "Sessão leve" },
  "{count} easy phrases": { pt: "{count} frases fáceis" },
  "Stop": { pt: "Parar" },
  "Nice work. This is a good place to stop, or take one light session.": {
    pt: "Bom trabalho. É um bom momento para parar, ou fazer uma sessão leve.",
  },
  "Stop here": { pt: "Parar por aqui" },
  "Today's method": { pt: "Método de hoje" },
  "Save your first phrases": { pt: "Salve suas primeiras frases" },
  "Start with the demo or one source. Keep a small set so review stays light.": {
    pt: "Comece com a demonstração ou uma fonte. Mantenha um conjunto pequeno para a revisão ficar leve.",
  },
  "Open Discover": { pt: "Abrir Descobrir" },
  "Review before adding more": { pt: "Revise antes de adicionar mais" },
  "{count} practice phrases due now. Review first, then add more.": {
    pt: "{count} frases para praticar esperando agora. Revise primeiro, depois adicione mais.",
  },
  "Reinforce {label}": { pt: "Reforçar {label}" },
  "Use the weak spots list below to practice saved phrases or create new variants.": {
    pt: "Use a lista de pontos fracos abaixo para praticar frases salvas ou criar novas variações.",
  },
  "Produce language this week": { pt: "Produza inglês esta semana" },
  "{count} conversations left for your weekly rhythm.": {
    pt: "{count} conversas restantes para o seu ritmo semanal.",
  },
  "Start conversation": { pt: "Iniciar conversa" },
  "Add the next small batch": { pt: "Adicione o próximo lote pequeno" },
  "You are caught up. Add fresh input only when you want more material.": {
    pt: "Você está em dia. Adicione material novo só quando quiser mais conteúdo.",
  },
  "{provider} is unavailable. Open Settings to connect it.": {
    pt: "{provider} está indisponível. Abra Configurações para conectar.",
  },
  "The selected AI": { pt: "A IA selecionada" },
  'No saved material left for "{label}" to generate from.': {
    pt: 'Não há mais material salvo de "{label}" para gerar a partir dele.',
  },
  "Couldn't create new practice phrases.": { pt: "Não foi possível criar novas frases para praticar." },
  "Couldn't reach IA. Try again.": { pt: "Não foi possível conectar à IA. Tente novamente." },
  "Review order": { pt: "Ordem de revisão" },
  "Active": { pt: "Ativo" },
  "Holding": { pt: "Aguardando" },
  "Gathering data": { pt: "Coletando dados" },
  "Due phrases are ordered toward the best recall zone first.": {
    pt: "As frases pendentes são ordenadas priorizando a melhor faixa de retenção.",
  },
  "Today's next step": { pt: "Próximo passo de hoje" },
  "Start with the recommended path.": { pt: "Comece pelo caminho recomendado." },
  "Start · {load}": { pt: "Começar · {load}" },
  "Recommended": { pt: "Recomendado" },
  "Pronunciation": { pt: "Pronúncia" },
  "Listen, repeat, then check what was heard.": { pt: "Ouça, repita e depois veja o que foi reconhecido." },
  "Playing...": { pt: "Tocando..." },
  "Checking...": { pt: "Verificando..." },
  "Try again": { pt: "Tentar de novo" },
  "Record": { pt: "Gravar" },
  "Completeness": { pt: "Completude" },
  "Rhythm": { pt: "Ritmo" },
  "Heard: {transcript}": { pt: "Reconhecido: {transcript}" },
  "Couldn't play the reference audio.": { pt: "Não foi possível tocar o áudio de referência." },
  "Couldn't make out any speech in that clip.": { pt: "Não foi possível reconhecer fala nesse áudio." },
  "Pronunciation assessment failed.": { pt: "A avaliação de pronúncia falhou." },
  "Couldn't access the microphone. Check the browser's permission.": {
    pt: "Não foi possível acessar o microfone. Verifique a permissão do navegador.",
  },

  // Onboarding welcome screen — explains actions without naming the differentiators being tested.
  Listen: { pt: "Ouça" },
  "Hear a phrase in context.": { pt: "Ouça uma frase no contexto." },
  "Keep a phrase you want to review.": { pt: "Guarde uma frase que você queira revisar." },
  Write: { pt: "Escreva" },
  "Use the phrase in an English sentence.": { pt: "Use a frase em uma frase em inglês." },

  // Onboarding profile step + TranscriptReview (bundled lesson phrase list, also used by Discover).
  "Three choices are enough to start. You can tune the rest later.": {
    pt: "Três escolhas já bastam para começar. Você pode ajustar o resto depois.",
  },
  "{segments} phrases · {kept} saved": { pt: "{segments} frases · {kept} salvas" },
  "Save practice phrases →": { pt: "Salvar frases para praticar →" },
  "Pause clip": { pt: "Pausar áudio" },
  "Play clip": { pt: "Tocar áudio" },
  "Saved": { pt: "Salva" },

  // WeaknessList (always rendered on the Study tab, not gated behind a review threshold).
  "Weak spots to reinforce": { pt: "Pontos fracos para reforçar" },
  "The app ranks concepts, error types, and situations from your reviews. Practice saved phrases, or create fresh variants from the same sources.": {
    pt: "O app ordena conceitos, tipos de erro e situações a partir das suas revisões. Pratique frases salvas ou crie novas variações a partir das mesmas fontes.",
  },
  "No patterns detected yet. Review a few phrases or run a correction session first.": {
    pt: "Ainda não há padrões detectados. Revise algumas frases ou faça uma correção primeiro.",
  },
  "error type": { pt: "tipo de erro" },
  "concept": { pt: "conceito" },
  "situation": { pt: "situação" },
  "{count} reviews": { pt: "{count} revisões" },
  "Drill": { pt: "Treinar" },
  "Create new practice phrases for this weak spot from existing sources": {
    pt: "Criar novas frases para praticar este ponto fraco a partir das fontes existentes",
  },
  "New phrases": { pt: "Novas frases" },
  "Fewer errors of this type in your writing over time": {
    pt: "Menos erros desse tipo na sua escrita ao longo do tempo",
  },
  "More errors of this type in your writing over time": {
    pt: "Mais erros desse tipo na sua escrita ao longo do tempo",
  },

  /* ── c1 diagnosis (experimental) ─────────── */
  "C1 diagnosis": { pt: "Diagnóstico C1" },
  "C1 diagnosis (experimental)": { pt: "Diagnóstico C1 (experimental)" },
  "Register, naturalness, and collocation feedback for past B1/B2 writing.": {
    pt: "Feedback de registro, naturalidade e colocação para escrita acima de B1/B2.",
  },
  Experimental: { pt: "Experimental" },
  "Open C1 diagnosis": { pt: "Abrir" },
  "Past B1/B2, grammar stops being the gap — register, naturalness, and collocation take over. This checks a short writing sample for that gap and lets you practice speaking the fix.":
    {
      pt: "Acima de B1/B2, a gramática deixa de ser o limite — registro, naturalidade e colocação passam a importar mais. Isso avalia uma amostra curta de escrita nessa dimensão e deixa você praticar falando a versão corrigida.",
    },
  "Domain: {domain}": { pt: "Domínio: {domain}" },
  Edit: { pt: "Editar" },
  "What's this for?": { pt: "Para que é isso?" },
  "Work, university, immigration — one domain, picked once. Steers the feedback toward language you'll actually use.":
    {
      pt: "Trabalho, universidade, imigração — um domínio, escolhido uma vez. Direciona o feedback para a linguagem que você realmente vai usar.",
    },
  "e.g. work": { pt: "ex.: trabalho" },
  "Where you're stuck": { pt: "Onde você está travando" },
  Grammar: { pt: "Gramática" },
  reviews: { pt: "revisões" },
  "Register, naturalness, collocation": { pt: "Registro, naturalidade, colocação" },
  "Write a short C1-level sample": { pt: "Escreva uma amostra curta em nível C1" },
  "A paragraph or two in your domain. This checks for what a native speaker would phrase differently.":
    {
      pt: "Um ou dois parágrafos no seu domínio. Isso verifica o que um falante nativo diria de forma diferente.",
    },
  "Write about {domain}…": { pt: "Escreva sobre {domain}…" },
  "your domain": { pt: "seu domínio" },
  "Checking…": { pt: "Verificando…" },
  "Check with AI →": { pt: "Verificar com IA →" },
  "{provider} is unavailable. Open Settings to connect one.": {
    pt: "{provider} está indisponível. Abra as Configurações para conectar uma IA.",
  },
  "No gaps found in this sample — try a longer or more ambitious one.": {
    pt: "Nenhuma lacuna encontrada nessa amostra — tente uma mais longa ou mais ambiciosa.",
  },
  "Couldn't check that sample.": { pt: "Não consegui verificar essa amostra." },
  "Practice speaking the fix": { pt: "Pratique falando a correção" },
  Hide: { pt: "Ocultar" },
  "Practice speaking": { pt: "Praticar a fala" },

  "cards reviewed": { pt: "cartões revisados" },
  accuracy: { pt: "precisão" },

  /* ── level advancement: readiness coach + level test ────── */
  "Level coach": { pt: "Coach de nível" },
  "You're at the top of the level ladder. Keep refining naturalness and register.": { pt: "Você está no topo da escada de níveis. Continue refinando naturalidade e registro." },
  "Evidence from your real practice decides when the level test unlocks.": { pt: "As evidências da sua prática real decidem quando o teste de nível é liberado." },
  "Evidence toward {level}": { pt: "Evidências rumo ao {level}" },
  "Recent practice": { pt: "Prática recente" },
  "Recall under control": { pt: "Memorização sob controle" },
  "Stable phrases": { pt: "Frases estáveis" },
  "Production quality": { pt: "Qualidade de produção" },
  "Overall signal": { pt: "Sinal geral" },
  "Recent check-in": { pt: "Check-in recente" },
  done: { pt: "feito" },
  pending: { pt: "pendente" },
  "What's in the way": { pt: "O que está no caminho" },
  "Take the level test": { pt: "Fazer o teste de nível" },
  "Available again in {count} day(s).": { pt: "Disponível de novo em {count} dia(s)." },
  "Next step: {criterion}.": { pt: "Próximo passo: {criterion}." },
  "Level test: {from} → {to}": { pt: "Teste de nível: {from} → {to}" },
  "Part 1 of 3 · Reading": { pt: "Parte 1 de 3 · Leitura" },
  "Part 2 of 3 · Sentences": { pt: "Parte 2 de 3 · Frases" },
  "Part 3 of 3 · Writing": { pt: "Parte 3 de 3 · Escrita" },
  Close: { pt: "Fechar" },
  "Three short parts at the {level} level: read a text, complete sentences, and write a few lines. Everything is pitched at the next level — it should feel harder than your reviews.": { pt: "Três partes curtas no nível {level}: ler um texto, completar frases e escrever algumas linhas. Tudo é calibrado para o próximo nível — deve parecer mais difícil que as suas revisões." },
  "Start the test": { pt: "Começar o teste" },
  "Preparing your test…": { pt: "Preparando seu teste…" },
  "Evaluating your writing…": { pt: "Avaliando sua escrita…" },
  "Complete each sentence with the missing word or phrase.": { pt: "Complete cada frase com a palavra ou expressão que falta." },
  "Write 3-6 sentences…": { pt: "Escreva de 3 a 6 frases…" },
  "Submit the test": { pt: "Enviar o teste" },
  "You advanced to {level}!": { pt: "Você avançou para o {level}!" },
  "Everything you discover, correct, and practice is now pitched at {level}.": { pt: "Tudo o que você descobrir, corrigir e praticar agora é calibrado para o {level}." },
  "Not this time — and that's useful.": { pt: "Não foi desta vez — e isso é útil." },
  "Your mistakes were saved as practice material. The coach shows what to reinforce before the next attempt.": { pt: "Seus erros foram salvos como material de prática. O coach mostra o que reforçar antes da próxima tentativa." },
  "Reading: {correct}/{total}": { pt: "Leitura: {correct}/{total}" },
  "Sentences: {correct}/{total}": { pt: "Frases: {correct}/{total}" },
  "Writing: {score}/100": { pt: "Escrita: {score}/100" },

  /* ── app chrome / a11y ──────────────────────────────────── */
  "PhraseLoop sections": { pt: "Seções do PhraseLoop" },
  "Toggle dark mode": { pt: "Alternar modo escuro" },
  "Open settings": { pt: "Abrir configurações" },
  "Back to Settings": { pt: "Voltar para Configurações" },
  "Advanced tools": { pt: "Ferramentas avançadas" },
  "Export to Anki, text-to-speech, and theme phrase lists.": {
    pt: "Export para Anki, texto para fala e listas de frases por tema.",
  },
  "Article URL": { pt: "Link de artigo" },
  "Source type": { pt: "Tipo de fonte" },

  /* ── error types ────────────────────────────────────────── */
  collocation: { pt: "colocação" },
  preposition: { pt: "preposição" },
  "verb tense": { pt: "tempo verbal" },
  article: { pt: "artigo" },
  "word order": { pt: "ordem das palavras" },
  idiom: { pt: "expressão idiomática" },
  vocabulary: { pt: "vocabulário" },
  register: { pt: "registro" },
  other: { pt: "outro" },

  /* ── correction tab ─────────────────────────────────────── */
  "Turn mistakes into review": { pt: "Transforme erros em revisão" },
  "Paste, speak, or enter what you produced. Save only the corrections worth reviewing.": {
    pt: "Cole, fale ou digite o que você produziu. Salve só as correções que valem revisar.",
  },
  "Correction input mode": { pt: "Modo de entrada de correções" },
  "AI review": { pt: "Revisão com IA" },
  "Manual entry": { pt: "Entrada manual" },
  Situation: { pt: "Situação" },
  "Tags every mistake below, so your weak spots group by situation — not just grammar.": {
    pt: "Marca cada erro abaixo, para seus pontos fracos se agruparem por situação — não só por gramática.",
  },
  "work, travel, ordering at a restaurant…": {
    pt: "trabalho, viagem, pedir em um restaurante…",
  },
  "Import correction JSON or temporarily change the AI.": {
    pt: "Importe JSON de correções ou troque a IA temporariamente.",
  },
  "JSON import selected": { pt: "Importação de JSON selecionada" },
  "Paste correction JSON": { pt: "Colar JSON de correções" },
  "Taking longer than expected. Try fewer corrections or a faster AI.": {
    pt: "Está demorando mais do que o esperado. Tente menos correções ou uma IA mais rápida.",
  },
  "Generation canceled. Your corrections are still here.": {
    pt: "Geração cancelada. Suas correções continuam aqui.",
  },
  "Creating focused phrases to practice…": { pt: "Criando frases focadas para praticar…" },
  "Reviewing phrase quality…": { pt: "Revisando a qualidade das frases…" },
  "Preparing audio and Anki export…": { pt: "Preparando áudio e export para Anki…" },
  "Still working — local models take longer with several corrections…": {
    pt: "Ainda trabalhando — modelos locais demoram com várias correções…",
  },
  "1 practice phrase ready to save.": { pt: "1 frase de prática pronta para salvar." },
  "{count} practice phrases ready to save.": {
    pt: "{count} frases de prática prontas para salvar.",
  },
  "No usable corrections found (need `original` + `corrected`).": {
    pt: "Nenhuma correção utilizável encontrada (precisa de `original` + `corrected`).",
  },
  "Couldn't parse that — expected JSON (an object or an array of them).": {
    pt: "Não consegui ler isso — esperava JSON (um objeto ou uma lista deles).",
  },
  "No mistakes found — that already sounds natural. 🎉": {
    pt: "Nenhum erro encontrado — isso já soa natural. 🎉",
  },
  "No errors found — see the naturalness upgrades below.": {
    pt: "Nenhum erro encontrado — veja as melhorias de naturalidade abaixo.",
  },
  "Couldn't evaluate the text.": { pt: "Não consegui avaliar o texto." },
  "{provider} is unavailable. Open Settings with the gear button to connect one.": {
    pt: "{provider} está indisponível. Abra Configurações no botão de engrenagem para conectar uma.",
  },
  "Correction study list preview": { pt: "Prévia da lista de estudo das correções" },
  "Practice phrase preview": { pt: "Prévia das frases de prática" },
  "Write or record a few sentences in English. The AI will find what a native speaker would say differently.": {
    pt: "Escreva ou grave algumas frases em inglês. A IA encontra o que um nativo diria diferente.",
  },
  "Stop recording": { pt: "Parar gravação" },
  "Transcribing…": { pt: "Transcrevendo…" },
  "Record speech": { pt: "Gravar fala" },
  "Upload audio": { pt: "Enviar áudio" },
  "Evaluating…": { pt: "Avaliando…" },
  "Local AI is offline or has no installed models.": {
    pt: "A IA local está desligada ou sem modelos instalados.",
  },
  "Open Settings to check the connection.": {
    pt: "Abra Configurações para verificar a conexão.",
  },
  "What you said": { pt: "O que você disse" },
  "Natural English version": { pt: "Versão natural em inglês" },
  "Error type": { pt: "Tipo de erro" },
  "Why it was wrong": { pt: "Por que estava errado" },
  "age uses 'be', not 'have'": { pt: "idade usa 'be', não 'have'" },
  "+ Add to list": { pt: "+ Adicionar à lista" },
  "Paste the correction tool's output, e.g.": {
    pt: "Cole a saída da ferramenta de correção, ex.:",
  },
  "Import corrections": { pt: "Importar correções" },
  "Corrections to drill": { pt: "Correções para treinar" },
  "1 correction ready": { pt: "1 correção pronta" },
  "{count} corrections ready": { pt: "{count} correções prontas" },
  "Save to study →": { pt: "Salvar para estudar →" },
  "Larger study lists can take a little longer while audio is created. You can cancel safely.": {
    pt: "Listas de estudo maiores podem demorar um pouco mais enquanto o áudio é criado. Você pode cancelar sem perder nada.",
  },
  "Remove correction": { pt: "Remover correção" },
  Remove: { pt: "Remover" },
  "Naturalness upgrades": { pt: "Melhorias de naturalidade" },
  "Correct, but stronger options a native speaker would likely reach for.": {
    pt: "Correto, mas com opções mais fortes que um nativo provavelmente usaria.",
  },
  "Strengths:": { pt: "Pontos fortes:" },
  "Next focus:": { pt: "Próximo foco:" },

  /* ── study list preview / export ────────────────────────── */
  "Study list preview": { pt: "Prévia da lista de estudo" },
  "1 practice phrase ready to study": { pt: "1 frase de prática pronta para estudar" },
  "{count} practice phrases ready to study": {
    pt: "{count} frases de prática prontas para estudar",
  },
  "Sending…": { pt: "Enviando…" },
  "Export to Anki": { pt: "Enviar ao Anki" },
  "Exporting…": { pt: "Exportando…" },
  "Export for Anki": { pt: "Exportar para o Anki" },
  Text: { pt: "Texto" },
  "Save & review now": { pt: "Salvar e revisar agora" },
  Dismiss: { pt: "Dispensar" },
  "Saved 1 practice phrase to study.": { pt: "1 frase de prática salva para estudar." },
  "Saved {count} practice phrases to study.": {
    pt: "{count} frases de prática salvas para estudar.",
  },
  "Could not save the study list.": { pt: "Não consegui salvar a lista de estudo." },
  "Could not export to Anki.": { pt: "Não consegui exportar para o Anki." },
  "Review now →": { pt: "Revisar agora →" },
  Front: { pt: "Frente" },
  "Back side": { pt: "Verso" },
  AI: { pt: "IA" },
  unavailable: { pt: "indisponível" },
  "Ollama model": { pt: "Modelo Ollama" },
};
