# SMR Zorgpad — Operationeel Handboek

> Dit systeem stuurt automatisch gepersonaliseerde e-mails naar patiënten die stoppen met roken.  
> Gebouwd door: Salih Kayhan · Beheer: zie sectie 4

---

## 1. Overzicht — Wat doet dit systeem?

```
Apotheek meldt patiënt aan (intake formulier)
    ↓
n8n maakt profiel aan in Supabase + plant 5 follow-up momenten
    ↓
n8n stuurt elke dag om 08:00 automatisch gepersonaliseerde e-mails
    ↓
Patiënt opent app → stemt stemming → risicoscore wordt bijgewerkt
    ↓
Bij hoog risico → apotheker krijgt direct een alert e-mail
```

**De apotheker hoeft niets te doen.** Alles is automatisch.

---

## 2. De 4 componenten

| Component | Wat het doet | URL |
|-----------|-------------|-----|
| **n8n** | Automatisering — de "hersenen" | `n8n.skyhan.app` |
| **Supabase** | Database — patiëntgegevens | `supabase.com` → project `nhkezhyu...` |
| **Cloudflare Pages** | Patiënt mini-app + intake formulier | `smr-app.pages.dev` |
| **Retool** | Apotheker dashboard | `retool.com` |

---

## 3. De 3 workflows in n8n

### 3a. SMR — Patiënt Intake
**Wanneer:** Zodra een nieuw patiënt het intakeformulier invult  
**Wat het doet:**
1. Maakt patiëntprofiel aan in Supabase
2. Plant 5 follow-up momenten (dag 7, 14, 30, 60, 90)
3. Genereert gepersonaliseerde welkomstmail via OpenAI
4. Stuurt welkomstmail via Gmail

**Als dit faalt:** Patiënt heeft geen profiel. Controleer of e-mail al bestaat (duplicate). Open de uitvoering in n8n voor details.

---

### 3b. SMR — Dagelijkse Follow-up
**Wanneer:** Elke dag om 08:00 automatisch  
**Wat het doet:**
1. Haalt op wie vandaag een follow-up gepland heeft
2. Genereert persoonlijke tekst via OpenAI
3. Stuurt e-mail naar patiënt
4. Markeert follow-up als verzonden in Supabase
5. Als risicoscore > 70 → stuurt alert e-mail naar apotheker

**Als dit faalt:** Patiënten hebben die dag geen e-mail ontvangen. Controleer Gmail OAuth2 (meest voorkomende oorzaak — zie sectie 5).

---

### 3c. SMR — Mood Handler
**Wanneer:** Zodra een patiënt een stemming instuurt via de app  
**Wat het doet:**
1. Herberekent de dropout risicoscore
2. Slaat nieuwe score op in Supabase
3. Als stemming "Moeilijk" + score > 70 → stuurt alert e-mail naar apotheker

**Als dit faalt:** Risicoscores worden niet bijgewerkt. Niet kritisch voor de dagelijkse werking.

---

### 3d. SMR — Error Handler
**Wanneer:** Als een van de 3 bovenstaande workflows faalt  
**Wat het doet:** Stuurt direct een e-mail naar `skayhan0@gmail.com` met:
- Welke workflow er gefaald heeft
- Welk node als laatste uitvoerde
- De foutmelding
- Een link naar de uitvoering in n8n

---

## 4. Dagelijks beheer — Wat moet je controleren?

Normaal gesproken **niets**. Het systeem runt volledig automatisch.

Je krijgt een e-mail als er iets misgaat (zie sectie 3d).

**Wekelijks (optioneel):** Controleer in Retool of nieuwe patiënten zijn aangemeld en of follow-ups correct zijn uitgestuurd.

---

## 5. Veelvoorkomende problemen

### Probleem: "Gmail node gefaald" in de foutmelding
**Oorzaak:** Gmail OAuth2 token is verlopen (gebeurt na langere inactiviteit)  
**Oplossing:**
1. Ga naar `n8n.skyhan.app`
2. Open **SMR — Dagelijkse Follow-up**
3. Klik op de **Gmail** node
4. Klik **"Reconnect"** of **"Test"**
5. Log opnieuw in met het Google account

---

### Probleem: "OpenAI node gefaald"
**Oorzaak:** OpenAI API quota vol of API tijdelijk onbereikbaar  
**Oplossing:**
1. Wacht 10 minuten en probeer opnieuw
2. Controleer `platform.openai.com` → Usage dashboard
3. Als quota vol: voeg tegoed toe of verlaag `max_tokens` in de Code node

---

### Probleem: Patiënt staat niet in Retool
**Oorzaak:** Intake webhook gefaald of e-mail al in gebruik  
**Oplossing:**
1. Ga naar `n8n.skyhan.app` → Executions
2. Zoek de betreffende intake uitvoering
3. Controleer de foutmelding — meest voorkomend: "duplicate key" (e-mail al in gebruik)

---

### Probleem: n8n is niet bereikbaar
**Oorzaak:** VPS server herstart of n8n service gestopt  
**Oplossing:**
1. Je hebt al een UptimeRobot e-mail ontvangen als dit het geval is
2. Herstel: herstart de n8n service op de server

---

### Probleem: Patiënt app (`smr-app.pages.dev`) laadt niet
**Oorzaak:** Cloudflare Pages deploy gefaald na een code update  
**Oplossing:**
1. Ga naar `cloudflare.com` → Pages → smr-app
2. Controleer of de laatste deploy geslaagd is
3. Bij fout: trigger een nieuwe deploy via GitHub push

---

## 6. Nieuwe patiënt aanmelden

Ga naar `smr-app.pages.dev/intake` en vul het formulier in.

Het systeem doet de rest automatisch.

---

## 7. Patiënt verwijderen (GDPR)

Ga naar het **Retool dashboard** → selecteer de patiënt → klik **"GDPR Verwijderen"**.

Het systeem:
1. Logt de verwijdering (e-mailhash, reden, datum)
2. Verwijdert alle patiëntgegevens uit Supabase
3. Maakt een audit-entry aan

---

## 8. Monitoring

| Wat | Hoe |
|-----|-----|
| Workflow crashes | Automatische e-mail van SMR Error Handler |
| Server downtime | Automatische e-mail van UptimeRobot |
| Follow-up overzicht | Retool dashboard → patiënttabel |

---

## 9. Contact

Vragen over het systeem? Neem contact op met **Salih Kayhan**.

Inloggegevens voor n8n, Supabase en Retool zijn opgeslagen in het beveiligde `.env` bestand en in de beheeromgeving.

---

*SMR Zorgpad Automatisering · Versie 1.0 · Juni 2026*
