# Postup pro rotaci a odstranění citlivých klíčů z repozitáře

## 1. Odstranění klíčů ze souborů
- Smažte všechny .env, .env.local a další soubory obsahující klíče z repozitáře.
- Ujistěte se, že .gitignore ignoruje všechny .env* soubory kromě .env.example.

## 2. Vyčištění git historie
- Použijte BFG Repo-Cleaner nebo git-filter-repo s passwords.txt:

### BFG příkaz:
```
bfg --replace-text passwords.txt
```

### git-filter-repo příkaz:
```
git filter-repo --replace-text passwords.txt
```

- passwords.txt musí obsahovat všechny klíče k odstranění (viz příklad v repo).

## 3. Rotace klíčů
- Vygenerujte nové klíče ve službách:
  - Supabase (Service Role Key)
  - Pinata (API Key, Secret, JWT)
  - nft.storage (API Key)
- Nastavte nové klíče pouze v Netlify/CI/CD environment variables.
- Nikdy neukládejte nové klíče do repozitáře!

## 4. Ověření
- Ověřte, že žádné klíče nejsou v repozitáři ani v historii (git log, git grep).
- Otestujte všechny endpointy s novými klíči.

## 5. Monitoring
- Pravidelně kontrolujte logy a alerty na podezřelé aktivity.
- Nastavte pravidelnou rotaci klíčů (např. každých 6 měsíců).

---
**Bezpečnost je prioritou!**
Pokud si nejste jisti, kontaktujte správce projektu nebo bezpečnostního specialistu.
