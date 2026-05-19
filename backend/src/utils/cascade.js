const Course = require("../models/Course");
const Semester = require("../models/Semester");
const Subject = require("../models/Subject");
const PYQ = require("../models/PYQ");
const User = require("../models/User");

async function deleteInstituteTree(instituteId) {
  const courses = await Course.find({ institute: instituteId }).select("_id");
  const courseIds = courses.map((course) => course._id);

  await Promise.all([
    PYQ.deleteMany({ institute: instituteId }),
    Subject.deleteMany({ institute: instituteId }),
    Semester.deleteMany({ institute: instituteId }),
    Course.deleteMany({ institute: instituteId }),
    User.updateMany(
      {},
      { $pull: { adminScopes: { institute: instituteId } } }
    ),
  ]);

  return { deletedCourses: courseIds.length };
}

async function deleteCourseTree(courseId) {
  await Promise.all([
    PYQ.deleteMany({ course: courseId }),
    Subject.deleteMany({ course: courseId }),
    Semester.deleteMany({ course: courseId }),
    User.updateMany({}, { $pull: { adminScopes: { course: courseId } } }),
  ]);
}

async function deleteSemesterTree(semesterId) {
  await Promise.all([
    PYQ.deleteMany({ semester: semesterId }),
    Subject.deleteMany({ semester: semesterId }),
  ]);
}

async function deleteSubjectTree(subjectId) {
  await PYQ.deleteMany({ subject: subjectId });
}

module.exports = {
  deleteInstituteTree,
  deleteCourseTree,
  deleteSemesterTree,
  deleteSubjectTree,
};
