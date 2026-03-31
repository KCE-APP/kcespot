/**
 * Verification Script for Assignment Module Logic
 * This script mocks Mongoose models and Express req/res objects 
 * to verify the controller logic without a live database.
 */

const { createAssignment, getMyAssignments, submitAssignment } = require("../controllers/assignmentController");
const Assignment = require("../models/Assignment");
const User = require("../models/User");
const Submission = require("../models/Submission");

// Mocking Models
jest.mock("../models/Assignment");
jest.mock("../models/User");
jest.mock("../models/Submission");
jest.mock("../service/pushNotificationService", () => ({
  sendAssignmentNotification: jest.fn().mockResolvedValue(true)
}));

describe("Assignment Controller Logic", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      user: { id: "staff123", role: "instructor" }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  test("createAssignment should find students and save assignment", async () => {
    req.body = {
      title: "Test Assignment",
      department: "CSE",
      section: "A",
      type: "assignment"
    };

    User.find.mockResolvedValue([
      { _id: "student1", pushTokens: ["token1"] },
      { _id: "student2", pushTokens: [] }
    ]);

    Assignment.prototype.save = jest.fn().mockResolvedValue({ _id: "task1" });

    await createAssignment(req, res);

    expect(User.find).toHaveBeenCalledWith(expect.objectContaining({ department: "CSE", section: "A" }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Assignment created successfully" }));
  });

  test("getMyAssignments should filter by assignedStudents", async () => {
    req.user = { id: "student1", role: "user" };
    Assignment.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([{ title: "My Task" }])
    });

    await getMyAssignments(req, res);

    expect(Assignment.find).toHaveBeenCalledWith(expect.objectContaining({ assignedStudents: "student1" }));
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ title: "My Task" })]));
  });
});

console.log("Verification plan: Run this with jest if environment allows, otherwise perform manual code review.");
