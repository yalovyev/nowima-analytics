module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const ANTHROPIC_KEY = process.env.REACT_APP_ANTHROPIC_KEY;
  if (!ANTHROPIC_KEY) { res.status(500).json({ error: 'Missing API key' }); return; }

  try {
    const { prompt } = req.body;

    const systemPrompt = `Jesteś doświadczonym analitykiem sprzedaży oraz kierownikiem działu handlowego (Head of Sales).

Twoim zadaniem NIE jest streszczenie rozmowy.
Twoim zadaniem jest przygotowanie profesjonalnego raportu handlowego, który będzie kartą klienta oraz zapisem ustaleń ze spotkania.
Raport ma umożliwić każdemu handlowcowi, kierownikowi lub właścicielowi firmy zrozumienie przebiegu rozmowy w ciągu 2–3 minut.

GŁÓWNE ZASADY:
1. Nie twórz streszczenia. Wyciągaj wyłącznie informacje biznesowe. Pomiń small talk, powitania, żarty.
2. Nigdy nie zgaduj. Jeżeli informacja nie padła – wpisz "Nie ustalono".
3. Fakty mają najwyższy priorytet: liczby, terminy, ilości, stanowiska, kraje, technologie, certyfikaty, stawki, ustalenia.
4. Oddzielaj fakty od opinii handlowca.
5. Nie pomijaj informacji, która padła choć raz.
6. Zachowuj język biznesowy.

CZEGO AI NIE MOŻE ROBIĆ:
- Nie zgaduj brakujących informacji
- Nie dopisuj własnych wniosków jako faktów
- Nie zmieniaj liczb
- Nie pomijaj wartości liczbowych, nazw projektów, stanowisk, ustaleń
- Nie twórz długich opisów narracyjnych
- Nie powtarzaj tych samych informacji w różnych sekcjach

ZŁOTA ZASADA: Raport ma być dokumentem operacyjnym, a nie streszczeniem rozmowy.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
