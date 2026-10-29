
## Container twarić

```code
docker build -f docker/Dockerfile -t webcaptioner-ng-back .
```

## Keycloak

Der Account-Login öffnet das Keycloak-Anmeldefenster. Zugriff haben nur Mitglieder der Realm-Gruppe `webcaptioner`. Admins brauchen zusätzlich die Realm-Rolle `admin`.

In der Server-`.env` müssen diese Werte zum Realm und Client passen:

```
KEYCLOAK_URL=https://keycloak.example/
KEYCLOAK_REALM=webcaptioner
KEYCLOAK_CLIENT_ID=webcaptioner-backend
KEYCLOAK_CLIENT_SECRET=<Client-Secret aus Keycloak>
KEYCLOAK_ADMIN_ROLE=admin
KEYCLOAK_REQUIRED_GROUP=webcaptioner
```

Nach einer Änderung am Secret den Server neu starten.

### 1. Realm

Oben links den Realm `webcaptioner` auswählen. Fehlt er, mit diesem Namen neu anlegen.

### 2. Gruppe

**Groups** → **Create group** → Name: `webcaptioner`.

Das ist eine Realm-Gruppe, keine Rolle.

### 3. Admin-Rolle

**Realm roles** → **Create role** → Name: `admin`.

Nur Nutzer mit dieser Rolle werden in der App Admins. Alle anderen Mitglieder der Gruppe sind normale Nutzer.

### 4. Client

**Clients** → **Create client**.

- Client ID: `webcaptioner-backend`
- Client authentication: an
- Standard flow: an
- Direct access grants: aus

Unter **Settings**, Bereich Access settings:

- **Valid redirect URIs:** `http://localhost:3000/authentication/callback`
- **Valid post logout redirect URIs:** `http://localhost:3000/authentication/login`

Jede Adresse mit **+** in die Liste übernehmen und danach **Save** klicken. Steht sie nur im Eingabefeld, gilt sie nicht.

Läuft die App nicht nur lokal, dieselben Pfade für die echte Frontend-Adresse eintragen, zum Beispiel `https://deine-app.example/authentication/callback` und `https://deine-app.example/authentication/login`.

Unter **Credentials** das Client-Secret kopieren und in `KEYCLOAK_CLIENT_SECRET` eintragen.

### 5. Gruppen ins Access-Token

**Client scopes** → **Create client scope**.

- Name: `groups`
- Protocol: OpenID Connect

Im Scope unter **Mappers** → **Add mapper** → **By configuration** → **Group Membership**:

- Token Claim Name: `groups`
- Add to access token: an
- Add to lightweight access token: an
- Add to ID token: an

Danach **Clients** → `webcaptioner-backend` → **Client scopes** → **Add client scope** → `groups` als **Default** hinzufügen.

Die Standard-Scopes `profile`, `email` und `roles` müssen ebenfalls Default bleiben. `roles` liefert die Admin-Rolle, `email` die E-Mail-Adresse. Ein Scope nur als Optional reicht nicht, weil die Anmeldung `openid profile email` anfragt.

### 6. Nutzer

Beim Anlegen eine E-Mail eintragen. Danach:

- Tab **Groups** → der Gruppe `webcaptioner` beitreten
- Admins zusätzlich Tab **Role mapping** → Realm-Rolle `admin` zuweisen

Ohne die Gruppe gibt es keinen Zugriff, auch wenn das Passwort stimmt. Ist der Nutzer in keiner Gruppe, fehlt `groups` im Token ganz.

### 7. Prüfen

Einmal abmelden und neu anmelden. Im Access-Token muss `groups` stehen, zum Beispiel `["/webcaptioner"]`. Der Scope-Name allein im Feld `scope` reicht nicht. Fehlt `groups`, ist **Add to lightweight access token** aus oder der Nutzer ist nicht in der Gruppe.
