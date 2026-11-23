#!/usr/bin/env python3
"""Disposable HTTP integration suite. Uses only Python standard library and a local Docker test database."""
import http.cookiejar
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE = "http://127.0.0.1:8080"
MAILPIT = "http://127.0.0.1:8025"
PASS = []
FAIL = []
SKIP = []

def http(method, path, payload=None, opener=None, headers=None):
    if opener is None:
        opener = urllib.request.build_opener()
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(BASE + path, data=data, method=method,
        headers={"Accept": "application/json", **({"Content-Type": "application/json"} if data is not None else {}), **(headers or {})})
    try:
        with opener.open(request, timeout=20) as response:
            raw = response.read()
            try: body = json.loads(raw) if raw else None
            except ValueError: body = raw.decode(errors="replace")
            return response.status, body, dict(response.headers)
    except urllib.error.HTTPError as error:
        raw = error.read()
        try: body = json.loads(raw) if raw else None
        except ValueError: body = raw.decode(errors="replace")
        return error.code, body, dict(error.headers)

def checked(name, callback):
    try:
        callback()
        PASS.append(name)
        print("PASS", name, flush=True)
    except Exception as error:
        FAIL.append((name, str(error)))
        print("FAIL", name, str(error), flush=True)

def expect(method, path, codes, payload=None, opener=None, headers=None):
    status, body, response_headers = http(method, path, payload, opener=opener, headers=headers)
    if status not in codes:
        raise AssertionError(f"{method} {path} expected {codes}, got {status}: {str(body)[:400]}")
    return body, response_headers

def client():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

def mailpit_messages():
    with urllib.request.urlopen(MAILPIT + "/api/v1/messages", timeout=10) as response:
        return json.loads(response.read())["messages"]

def mailpit_message(mid):
    with urllib.request.urlopen(MAILPIT + "/api/v1/message/" + urllib.parse.quote(mid), timeout=10) as response:
        return json.loads(response.read())

def verification_token(email):
    for _ in range(25):
        for message in mailpit_messages():
            recipients = str(message.get("To", ""))
            if email.lower() not in recipients.lower():
                continue
            detail = mailpit_message(message.get("ID") or message.get("id"))
            body = detail.get("Text") or detail.get("HTML") or ""
            match = re.search(r"/verify-email\?token=([A-Za-z0-9_-]+)", body)
            if match:
                return match.group(1)
        time.sleep(1)
    raise AssertionError("Verification email/token not received in disposable Mailpit")

def main():
    status, health, _ = http("GET", "/actuator/health")
    checked("Production health endpoint", lambda: (_ for _ in ()).throw(AssertionError((status, health))) if status != 200 or health.get("status") != "UP" else None)
    guest = client()
    other = client()
    tree = {}
    people = {}

    def test_tree():
        body, response_headers = expect("POST", "/api/trees", {201}, {"name": "QA family " + uuid.uuid4().hex[:8]}, guest)
        tree.update(body)
        assert re.fullmatch(r"[0-9a-f-]{36}", tree["id"])
        assert any(key.lower() == "set-cookie" and "guest_session=" in value for key, value in response_headers.items())
        assert expect("GET", f"/api/trees/{tree['id']}", {200}, opener=guest)[0]["id"] == tree["id"]
    checked("Guest tree creation and guest cookie", test_tree)
    if not tree:
        print("FATAL: cannot run remaining HTTP checks without disposable tree")
        raise SystemExit(2)
    path = f"/api/trees/{tree['id']}"

    def test_guest_access():
        expect("GET", path, {404}, opener=other)
        expect("PATCH", path, {404}, {"name": "Cross-client overwrite"}, opener=other)
        assert expect("GET", path, {200}, opener=guest)[0]["id"] == tree["id"]
    checked("Separate guest cannot access or modify tree by UUID", test_guest_access)
    def test_tree_validation():
        expect("POST", "/api/trees", {400}, {"name": "  "}, guest)
        expect("POST", "/api/trees", {400}, {"name": "a" * 201}, guest)
        assert expect("PATCH", path, {200}, {"name": "QA renamed"}, guest)[0]["name"] == "QA renamed"
        assert expect("GET", path, {200}, opener=guest)[0]["name"] == "QA renamed"
    checked("Tree name validation, rename and persistence", test_tree_validation)
    def test_persons():
        for label in ["Grandparent", "Parent", "Child", "Second parent", "Third parent"]:
            person, _ = expect("POST", path + "/people", {201}, {"firstName": label}, guest)
            people[label] = person["id"]
        edited, _ = expect("PATCH", path + "/people/" + people["Parent"], {200},
            {"firstName": "Parent", "lastName": "Novak", "birthPlace": "Maribor"}, guest)
        assert edited["lastName"] == "Novak"
        hits, _ = expect("GET", path + "/people?search=Novak", {200}, opener=guest)
        assert any(p["id"] == people["Parent"] for p in hits)
        expect("POST", path + "/people", {400}, {"firstName": " "}, guest)
        expect("POST", path + "/people", {400}, {"firstName": "Invalid", "birthDate": "2000-01-01", "deathDate": "1999-12-31"}, guest)
    checked("Person create/edit/search and invalid date rejection", test_persons)
    if len(people) < 5:
        print("FATAL: unable to build topology")
        raise SystemExit(2)

    def pc(a, b, kind="BIOLOGICAL", codes={201}):
        return expect("POST", path + "/parent-child-relationships", codes,
           {"parentId": people[a], "childId": people[b], "relationshipType": kind}, guest)[0]

    def test_ancestry():
        pc("Grandparent", "Parent")
        pc("Parent", "Child")
        expect("POST", path + "/parent-child-relationships", {409},
            {"parentId":people["Parent"],"childId":people["Child"],"relationshipType":"BIOLOGICAL"},guest)
        expect("POST", path + "/parent-child-relationships", {400,409},
            {"parentId":people["Child"],"childId":people["Child"]},guest)
        cycle, _ = expect("POST", path + "/parent-child-relationships", {400,409},
            {"parentId":people["Child"],"childId":people["Grandparent"]},guest)
        assert isinstance(cycle, dict) and cycle.get("code") == "ANCESTRY_CYCLE", cycle
    checked("Ancestry downward data, duplicate/self/cycle rejection", test_ancestry)
    def test_two_parents():
        pc("Second parent", "Child", "ADOPTIVE")
        third_status, third_body, _ = http("POST", path + "/parent-child-relationships",
            {"parentId": people["Third parent"], "childId": people["Child"], "relationshipType":"BIOLOGICAL"}, opener=guest)
        if third_status == 201:
            # This deliberately exposes the divergence from the requested two-parent policy.
            # Remove the QA-only third relationship immediately, leaving test data consistent.
            if isinstance(third_body, dict) and third_body.get("id"):
                expect("DELETE", path + "/parent-child-relationships/" + third_body["id"], {204}, opener=guest)
            raise AssertionError("POLICY FAILURE: third parent was accepted (HTTP 201), user requires max 2 combined biological/adoptive")
        assert third_status in (400, 409), (third_status, third_body)
    checked("Maximum TWO total biological/adoptive parent relationships", test_two_parents)
    def test_cross_tree():
        other_tree, _ = expect("POST", "/api/trees", {201}, {"name": "Other test tree"}, guest)
        x, _ = expect("POST", "/api/trees/" + other_tree["id"] + "/people", {201}, {"firstName":"Other tree person"}, guest)
        expect("POST", path + "/parent-child-relationships", {400, 404},
               {"parentId":x["id"],"childId":people["Parent"]}, guest)
        expect("DELETE", "/api/trees/" + other_tree["id"], {204}, opener=guest)
    checked("Cross-tree parent relationship rejected", test_cross_tree)
    def test_partnership():
        body, _ = expect("POST", path + "/partnerships", {201},
            {"person1Id":people["Grandparent"], "person2Id":people["Parent"],"partnershipType":"MARRIAGE","isCurrent":True},guest)
        expect("POST", path + "/partnerships", {409},
            {"person1Id":people["Parent"], "person2Id":people["Grandparent"],"partnershipType":"MARRIAGE"},guest)
        expect("POST", path + "/partnerships", {400, 409},
            {"person1Id":people["Child"],"person2Id":people["Child"]},guest)
        graph, _ = expect("GET", path + "/graph", {200}, opener=guest)
        assert len(graph["people"]) == 5
        assert len(graph["partnerships"]) == 1
        assert len(graph["parentChildRelationships"]) == 3
        expect("DELETE", path + "/partnerships/" + body["id"], {204}, opener=guest)
    checked("Cross-generation partnership, duplicate/self checks, graph read and unlink", test_partnership)
    def test_no_photo_upload():
        # Prod intentionally disables persistent photo uploads.
        image = b"\x89PNG\r\n\x1a\n"
        boundary = "----FamilyTreeQaBoundary"
        raw = b"--" + boundary.encode() + b"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"test.png\"\r\nContent-Type: image/png\r\n\r\n" + image + b"\r\n--" + boundary.encode() + b"--\r\n"
        request = urllib.request.Request(BASE + path + "/photos", method="POST", data=raw,
            headers={"Content-Type":"multipart/form-data; boundary=" + boundary, "Cookie":"; ".join(f"{c.name}={c.value}" for c in next(h.cookiejar for h in guest.handlers if isinstance(h, urllib.request.HTTPCookieProcessor)))})
        try:
            with urllib.request.urlopen(request,timeout=15) as res: status=res.status
        except urllib.error.HTTPError as err: status=err.code
        assert status in (400,403,409,501,503), status
    checked("Production photo uploads disabled", test_no_photo_upload)

    def test_reg_verify():
        email = "qa-" + uuid.uuid4().hex[:12] + "@example.test"
        register = {"firstName":"QA","lastName":"Account","email":email,"password":"test-pass-Strong!123"}
        expect("POST","/api/auth/register",{202},register)
        expect("POST","/api/auth/login",{401},{"email":email,"password":register["password"]})
        token = verification_token(email)
        expect("POST","/api/auth/verify-email",{200},{"token":token})
        expect("POST","/api/auth/verify-email",{401,403},{"token":token})
        login, headers=expect("POST","/api/auth/login",{200},{"email":email,"password":register["password"]})
        assert "accessToken" in login
        assert "refresh_token" in str(headers).lower()
        me, _ = expect("GET","/api/auth/me",{200},headers={"Authorization":"Bearer "+login["accessToken"]})
        assert me["email"] == email
        expect("POST","/api/auth/login",{401},{"email":email,"password":"incorrect"})
    checked("Email verify + one-time token + login/JWT", test_reg_verify)
    def test_generic_reset():
        missing = "not-found-" + uuid.uuid4().hex[:10] + "@example.test"
        body, _ = expect("POST","/api/auth/password/forgot",{200},{"email":missing})
        assert isinstance(body,dict) and "If an account exists" in body.get("message","")
    checked("Password reset avoids account enumeration", test_generic_reset)
    def test_bad_auth():
        expect("GET","/api/auth/me",{401})
        expect("POST","/api/auth/refresh",{401})
        expect("GET","/api/auth/providers",{200})
        expect("GET","/api/trees/" + str(uuid.uuid4()),{404},opener=guest)
    checked("Unauthorized auth endpoints and nonexistent trees", test_bad_auth)

    checked("Delete disposable guest tree", lambda: expect("DELETE", path, {204}, opener=guest))
    print("\nTOTAL:",len(PASS),"passed;",len(FAIL),"failed;",len(SKIP),"skipped",flush=True)
    if FAIL:
        for name, error in FAIL: print("FAIL:",name,":",error,flush=True)
        raise SystemExit(1)

if __name__ == "__main__":
    main()
