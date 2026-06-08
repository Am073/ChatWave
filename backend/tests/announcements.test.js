const test = require('node:test');
const assert = require('node:assert');
const { startTestServer, stopTestServer, TestClient } = require('./helper');

test.describe('Announcement Scope & Isolation Tests', () => {
  let facultyClient;
  let studentSameDeptClient;
  let studentDiffDeptClient;
  let studentDiffCollegeClient;

  test.before(async () => {
    await startTestServer();

    // 1. Faculty Client (College A, CS Department)
    facultyClient = new TestClient();
    await facultyClient.get('/auth/csrf-token');
    await facultyClient.post('/auth/register', {
      name: 'CS Faculty',
      college_id: 'FAC_CS_01',
      password: 'Password@123',
      college_name: 'College A',
      department: 'Computer Science',
      role: 'faculty',
    });

    // 2. Student Same Dept Client (College A, CS Department)
    studentSameDeptClient = new TestClient();
    await studentSameDeptClient.get('/auth/csrf-token');
    await studentSameDeptClient.post('/auth/register', {
      name: 'CS Student A',
      college_id: 'STUDENT_CS_01',
      password: 'Password@123',
      college_name: 'College A',
      department: 'Computer Science',
      role: 'student',
    });

    // 3. Student Diff Dept Client (College A, ME Department)
    studentDiffDeptClient = new TestClient();
    await studentDiffDeptClient.get('/auth/csrf-token');
    await studentDiffDeptClient.post('/auth/register', {
      name: 'ME Student B',
      college_id: 'STUDENT_ME_01',
      password: 'Password@123',
      college_name: 'College A',
      department: 'Mechanical Engineering',
      role: 'student',
    });

    // 4. Student Diff College Client (College B, CS Department)
    studentDiffCollegeClient = new TestClient();
    await studentDiffCollegeClient.get('/auth/csrf-token');
    await studentDiffCollegeClient.post('/auth/register', {
      name: 'CS Student C',
      college_id: 'STUDENT_CS_02',
      password: 'Password@123',
      college_name: 'College B',
      department: 'Computer Science',
      role: 'student',
    });
  });

  test.after(async () => {
    await stopTestServer();
  });

  test('Create and verify department-private announcement visibility (Bug #6 Fix)', async () => {
    // 1. Faculty posts a department-private announcement
    const postRes = await facultyClient.post('/announcements', {
      title: 'CS Lab Exam Schedule',
      content: 'Private CS lab exam is scheduled for next Monday.',
      category: 'exam',
      is_private: true,
      department: 'Computer Science',
    });
    
    assert.strictEqual(postRes.status, 201);
    const annId = postRes.data._id;
    assert.ok(annId);

    // 2. Student from same college & department CAN see it
    const sameDeptRes = await studentSameDeptClient.get('/announcements');
    assert.strictEqual(sameDeptRes.status, 200);
    const hasAccess = sameDeptRes.data.some(ann => ann._id === annId);
    assert.strictEqual(hasAccess, true, 'Same department student should see the announcement');

    // 3. Student from same college but DIFFERENT department CANNOT see it
    const diffDeptRes = await studentDiffDeptClient.get('/announcements');
    assert.strictEqual(diffDeptRes.status, 200);
    const hasAccessDiffDept = diffDeptRes.data.some(ann => ann._id === annId);
    assert.strictEqual(hasAccessDiffDept, false, 'Different department student should not see it (Bug #6)');

    // 4. Student from DIFFERENT college CANNOT see it
    const diffCollegeRes = await studentDiffCollegeClient.get('/announcements');
    assert.strictEqual(diffCollegeRes.status, 200);
    const hasAccessDiffCollege = diffCollegeRes.data.some(ann => ann._id === annId);
    assert.strictEqual(hasAccessDiffCollege, false, 'Different college student should not see it');
  });
});
