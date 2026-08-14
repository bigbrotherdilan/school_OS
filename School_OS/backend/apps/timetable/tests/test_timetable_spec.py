"""
Permanent timetable test suite — the 16 spec-driven tests (Docs/"School OS
Timetable — Section-Based Generation, Shared Teacher Availability & Manual
Scheduling Architecture").

Covers:
  1. lesson suggestion volume (incl. group-aware splits)
  2. parallel student groups schedule simultaneously without clashing
  3. full-cohort lessons never overlap
  4. a teacher is never double-booked across classes
  5. committed (approved) timetables reserve resources school-wide
  6. drafts/uncommitted timetables reserve nothing
  7. multi-teacher splits sum to the weekly volume
  8. allocation volume mismatches are reported
  9. unassigned teacher (TBD) schedules without false conflicts
 10. manual-edit RED/YELLOW/GRAY/GREEN cell states
 11. double periods are consecutive and never split by a break
 12. half-day grids are respected
 13. blocked periods contain no lessons
 14. repair mode keeps the other class intact
 15. approval requires a clash-free timetable and commits resources
 16. validate_section_internal + validate_section_against_school

Run with:  python manage.py test apps.timetable.tests --keepdb
"""
from datetime import time

from django.test import TestCase
from rest_framework.test import APITestCase

from apps.timetable.models import (
    Timetable, TimeSlot, Lesson, StudentGroup, TeacherAllocation,
)
from apps.timetable.solver import (
    SchoolSolver, suggest_lessons_for, validate_timetable, _to_time, _overlaps,
)
from apps.timetable.conflicts import timetable_cell_states
from apps.timetable.section_tools import validate_section, validate_section_against_school

from .base import (
    make_tenant, make_user, make_teacher, make_year, make_section, make_class,
    make_subject, make_class_subject, make_assignment, make_timetable,
    make_lesson, make_unavailability,
)


class TimetableTestCase(TestCase):
    """Shared helpers for building + generating small deterministic grids."""

    def setUp(self):
        self.tenant = make_tenant()
        self.year = make_year(self.tenant)
        self.periods = [
            {'start': '07:30', 'end': '08:20'},
            {'start': '08:20', 'end': '09:10'},
            {'start': '09:10', 'end': '10:00'},
            {'start': '10:30', 'end': '11:20'},
        ]

    # ------------------------------------------------------------------ #
    def _generate(self, timetables, target_ids=None, time_limit=30):
        solver = SchoolSolver(timetables, target_ids=target_ids, time_limit_seconds=time_limit)
        return solver.solve()

    def _slots(self, tt):
        return list(tt.slots.select_related('subject', 'teacher', 'lesson').all())

    def _overlapping_slots(self, slots):
        """All pairs of slots that share a day + time window."""
        out = []
        for i, a in enumerate(slots):
            for b in slots[i + 1:]:
                if a.day_of_week == b.day_of_week and _overlaps(
                    a.start_time, a.end_time, b.start_time, b.end_time
                ):
                    out.append((a, b))
        return out

    def _day_of(self, slot):
        return slot.get_day_of_week_display()

    def _count_double_pairs(self, slots):
        """Non-overlapping same-day consecutive pairs across all slots."""
        pairs = 0
        by_day = {}
        for s in slots:
            by_day.setdefault(s.day_of_week, []).append(s)
        for day_list in by_day.values():
            day_list.sort(key=lambda s: s.start_time)
            i = 0
            while i + 1 < len(day_list):
                if day_list[i + 1].start_time == day_list[i].end_time:
                    pairs += 1
                    i += 2
                else:
                    i += 1
        return pairs


class TestLessonSuggestions(TimetableTestCase):
    def test_01_suggestions_cover_subject_volume_group_aware(self):
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        group_a = StudentGroup.objects.create(
            tenant=self.tenant, academic_class=cls, name='Arts'
        )
        make_class_subject(cls, maths, 5, student_group=group_a, is_double=True)
        teacher = make_teacher(self.tenant)
        make_assignment(teacher, cls, maths, student_group=group_a)
        tt = make_timetable(self.tenant, self.year, cls)

        created, total, doubles, error = suggest_lessons_for(tt)

        self.assertIsNone(error)
        lessons = list(tt.lessons.all())
        self.assertEqual(created, 2)  # 4-period double + 1 single
        self.assertEqual(total, 5)
        self.assertEqual(sum(l.periods_per_week for l in lessons), 5)
        for lesson in lessons:
            self.assertEqual(lesson.student_group_id, group_a.id)
            self.assertEqual(lesson.teacher_id, teacher.id)


class TestParallelGroups(TimetableTestCase):
    def test_02_parallel_groups_schedule_without_clashing(self):
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4')
        arts = StudentGroup.objects.create(
            tenant=self.tenant, academic_class=cls, name='Arts'
        )
        science = StudentGroup.objects.create(
            tenant=self.tenant, academic_class=cls, name='Science'
        )
        history = make_subject(self.tenant, 'History', '235')
        chemistry = make_subject(self.tenant, 'Chemistry', '523')
        make_class_subject(cls, history, 12, student_group=arts)
        make_class_subject(cls, chemistry, 12, student_group=science)
        teacher_h = make_teacher(self.tenant)
        teacher_c = make_teacher(self.tenant)
        make_assignment(teacher_h, cls, history, student_group=arts)
        make_assignment(teacher_c, cls, chemistry, student_group=science)
        tt = make_timetable(self.tenant, self.year, cls)

        suggest_lessons_for(tt)
        result = self._generate([tt])
        self.assertTrue(result['ok'], result.get('message'))
        slots = self._slots(tt)

        # 12 + 12 = 24 periods but only 20 slots: streams MUST run in parallel
        arts_slots = [s for s in slots if s.student_group_id == arts.id]
        sci_slots = [s for s in slots if s.student_group_id == science.id]
        self.assertEqual(len(arts_slots), 12)
        self.assertEqual(len(sci_slots), 12)
        shared = 0
        for a in arts_slots:
            for b in sci_slots:
                if a.day_of_week == b.day_of_week and _overlaps(
                    a.start_time, a.end_time, b.start_time, b.end_time
                ):
                    shared += 1
                    break
        self.assertGreater(shared, 0, 'parallel groups must share cells to fit the week')

        # ...and the validators must agree there is no student clash
        issues = validate_timetable(tt)
        student_clashes = [i for i in issues if i['type'] == 'student_clash']
        self.assertEqual(student_clashes, [])


class TestFullCohort(TimetableTestCase):
    def test_03_full_cohort_lessons_never_overlap(self):
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 3')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        english = make_subject(self.tenant, 'English', '301')
        make_class_subject(cls, maths, 8)
        make_class_subject(cls, english, 8)
        teacher_m = make_teacher(self.tenant)
        teacher_e = make_teacher(self.tenant)
        make_assignment(teacher_m, cls, maths)
        make_assignment(teacher_e, cls, english)
        tt = make_timetable(self.tenant, self.year, cls)

        suggest_lessons_for(tt)
        result = self._generate([tt])
        self.assertTrue(result['ok'], result.get('message'))
        slots = self._slots(tt)
        self.assertEqual(len(slots), 16)
        pairs = self._overlapping_slots(slots)
        self.assertEqual(pairs, [], 'two full-cohort lessons must never share a cell')


class TestTeacherNeverDoubleBooked(TimetableTestCase):
    def test_04_teacher_never_double_booked_across_classes(self):
        section = make_section(self.tenant)
        cls_a = make_class(self.tenant, section, 'Form 3A')
        cls_b = make_class(self.tenant, section, 'Form 3B')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        physics = make_subject(self.tenant, 'Physics', '522')
        teacher = make_teacher(self.tenant)
        make_class_subject(cls_a, maths, 8, is_double=False)
        make_class_subject(cls_b, physics, 8, is_double=False)
        make_assignment(teacher, cls_a, maths)
        make_assignment(teacher, cls_b, physics)
        tt_a = make_timetable(self.tenant, self.year, cls_a)
        tt_b = make_timetable(self.tenant, self.year, cls_b)

        suggest_lessons_for(tt_a)
        suggest_lessons_for(tt_b)
        result = self._generate([tt_a, tt_b])
        self.assertTrue(result['ok'], result.get('message'))

        teacher_slots = [
            s for s in self._slots(tt_a) + self._slots(tt_b)
            if s.teacher_id == teacher.id
        ]
        self.assertEqual(len(teacher_slots), 16)
        self.assertEqual(
            self._overlapping_slots(teacher_slots), [],
            'a teacher must never teach two classes at the same time',
        )
        report = validate_section([tt_a, tt_b])
        self.assertTrue(report['valid'], report['issues'])


class TestCommittedResources(TimetableTestCase):
    def test_05_committed_timetable_blocks_other_sections(self):
        anglo = make_section(self.tenant, 'Anglophone')
        franco = make_section(self.tenant, 'Francophone')
        cls_a = make_class(self.tenant, anglo, 'Form 4')
        cls_f = make_class(self.tenant, franco, '4ème')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        french = make_subject(self.tenant, 'French', '502')
        teacher = make_teacher(self.tenant)
        make_class_subject(cls_a, maths, 8, is_double=False)
        make_class_subject(cls_f, french, 8, is_double=False)
        make_assignment(teacher, cls_a, maths)
        make_assignment(teacher, cls_f, french)
        tt_a = make_timetable(self.tenant, self.year, cls_a)
        tt_f = make_timetable(self.tenant, self.year, cls_f)

        suggest_lessons_for(tt_a)
        result = self._generate([tt_a])
        self.assertTrue(result['ok'], result.get('message'))
        # Approve: Anglophone section is committed to the school schedule.
        tt_a.generation_status = Timetable.GenerationStatus.APPROVED
        tt_a.save(update_fields=['generation_status'])
        self.assertTrue(tt_a.is_committed())

        # Francophone section generates around the committed timetable.
        suggest_lessons_for(tt_f)
        result_f = self._generate([tt_f, tt_a], target_ids={tt_f.id})
        self.assertTrue(result_f['ok'], result_f.get('message'))

        committed = [s for s in self._slots(tt_a) if s.teacher_id == teacher.id]
        new = [s for s in self._slots(tt_f) if s.teacher_id == teacher.id]
        self.assertEqual(len(committed), 8)
        self.assertEqual(len(new), 8)
        overlaps = 0
        for a in committed:
            for b in new:
                if a.day_of_week == b.day_of_week and _overlaps(
                    a.start_time, a.end_time, b.start_time, b.end_time
                ):
                    overlaps += 1
        self.assertEqual(overlaps, 0, 'committed slots must block the other section')

        report = validate_section_against_school([tt_f])
        self.assertTrue(report['valid'], report['issues'])

    def test_06_draft_timetable_reserves_nothing(self):
        anglo = make_section(self.tenant, 'Anglophone')
        franco = make_section(self.tenant, 'Francophone')
        cls_a = make_class(self.tenant, anglo, 'Form 4')
        cls_f = make_class(self.tenant, franco, '4ème')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        french = make_subject(self.tenant, 'French', '502')
        teacher = make_teacher(self.tenant)
        make_class_subject(cls_a, maths, 12)
        make_class_subject(cls_f, french, 12)
        make_assignment(teacher, cls_a, maths)
        make_assignment(teacher, cls_f, french)
        tt_a = make_timetable(self.tenant, self.year, cls_a)
        tt_f = make_timetable(self.tenant, self.year, cls_f)

        suggest_lessons_for(tt_a)
        result_a = self._generate([tt_a])
        self.assertTrue(result_a['ok'], result_a.get('message'))
        # tt_a is GENERATED but NOT committed.

        # 12h for the same teacher in another section: still feasible, because
        # the draft reserves no teacher resource.
        suggest_lessons_for(tt_f)
        result_f = self._generate([tt_f, tt_a], target_ids={tt_f.id})
        self.assertTrue(result_f['ok'], result_f.get('message'))

        # Once approved, the same teacher only has 8 free cells -> infeasible.
        tt_a.generation_status = Timetable.GenerationStatus.APPROVED
        tt_a.save(update_fields=['generation_status'])
        result_f2 = self._generate([tt_f, tt_a], target_ids={tt_f.id})
        self.assertFalse(result_f2['ok'])
        self.assertIn('committed lessons in other sections', result_f2['message'])


class TestMultiTeacherSplits(TimetableTestCase):
    def test_07_split_allocations_schedule_and_sum_to_volume(self):
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        teacher_1 = make_teacher(self.tenant)
        teacher_2 = make_teacher(self.tenant)
        tt = make_timetable(self.tenant, self.year, cls)
        lesson = make_lesson(tt, maths, periods=8)
        TeacherAllocation.objects.create(lesson=lesson, teacher=teacher_1, periods=4)
        TeacherAllocation.objects.create(lesson=lesson, teacher=teacher_2, periods=4)

        result = self._generate([tt])
        self.assertTrue(result['ok'], result.get('message'))

        slots = self._slots(tt)
        self.assertEqual(len(slots), 8)
        t1_slots = [s for s in slots if s.teacher_id == teacher_1.id]
        t2_slots = [s for s in slots if s.teacher_id == teacher_2.id]
        self.assertEqual(len(t1_slots), 4)
        self.assertEqual(len(t2_slots), 4)
        self.assertTrue(
            all(s.lesson_id == lesson.id for s in slots),
            'all split slots must link to the lesson card',
        )

        issues = validate_timetable(tt)
        self.assertEqual([i for i in issues if i['type'] == 'allocation_volume'], [])

    def test_08_allocation_volume_mismatch_is_reported(self):
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        teacher_1 = make_teacher(self.tenant)
        teacher_2 = make_teacher(self.tenant)
        tt = make_timetable(self.tenant, self.year, cls)
        lesson = make_lesson(tt, maths, periods=8)
        TeacherAllocation.objects.create(lesson=lesson, teacher=teacher_1, periods=4)
        TeacherAllocation.objects.create(lesson=lesson, teacher=teacher_2, periods=2)

        issues = validate_timetable(tt)
        mismatch = [i for i in issues if i['type'] == 'allocation_volume']
        self.assertTrue(mismatch, '6 != 8 must be reported as an allocation volume error')
        self.assertEqual(mismatch[0]['severity'], 'error')

        # The generator must refuse to run on a bad split.
        result = self._generate([tt])
        self.assertFalse(result['ok'])
        self.assertIn('split across', result['message'])

        # Section-level validation reports it too.
        report = validate_section([tt])
        self.assertFalse(report['valid'])
        self.assertTrue(
            any(i['type'] == 'allocation_volume' for i in report['issues'])
        )


class TestUnassignedTeacher(TimetableTestCase):
    def test_09_tbd_schedules_without_false_conflicts(self):
        anglo = make_section(self.tenant, 'Anglophone')
        franco = make_section(self.tenant, 'Francophone')
        cls_a = make_class(self.tenant, anglo, 'Form 4')
        cls_f = make_class(self.tenant, franco, '4ème')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        french = make_subject(self.tenant, 'French', '502')
        teacher = make_teacher(self.tenant)
        tt_a = make_timetable(self.tenant, self.year, cls_a)
        tt_f = make_timetable(self.tenant, self.year, cls_f)
        make_lesson(tt_a, maths, teacher=None, periods=8)   # TBD
        make_lesson(tt_f, french, teacher=teacher, periods=8)

        result = self._generate([tt_a, tt_f])
        self.assertTrue(result['ok'], result.get('message'))

        a_slots = self._slots(tt_a)
        self.assertEqual(len(a_slots), 8)
        self.assertTrue(all(s.teacher_id is None for s in a_slots))
        # The TBD slots may freely overlap the real teacher's committed
        # schedule — they reserve no resource (assert at least one overlap
        # exists given a 20-cell week and 16 periods placed).
        f_slots = self._slots(tt_f)
        overlaps = 0
        for a in a_slots:
            for b in f_slots:
                if a.day_of_week == b.day_of_week and _overlaps(
                    a.start_time, a.end_time, b.start_time, b.end_time
                ):
                    overlaps += 1
                    break
        self.assertGreater(overlaps, 0,
                           'TBD slots should be able to occupy cells the real teacher uses')

        issues = validate_timetable(tt_a)
        self.assertEqual([i for i in issues if i['type'] == 'teacher_clash'], [])
        self.assertTrue(any(i['type'] == 'unassigned' for i in issues))

        states = timetable_cell_states(tt_a)
        for s in a_slots:
            self.assertEqual(states[str(s.pk)]['level'], 'gray')


class TestManualEditStates(TimetableTestCase):
    def test_10_red_yellow_gray_green_cell_states(self):
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        english = make_subject(self.tenant, 'English', '301')
        physics = make_subject(self.tenant, 'Physics', '522')
        teacher_1 = make_teacher(self.tenant)
        teacher_2 = make_teacher(self.tenant)
        tt = make_timetable(self.tenant, self.year, cls)

        green = TimeSlot.objects.create(
            timetable=tt, day_of_week=2, start_time='07:30', end_time='08:20',
            subject=maths, teacher=teacher_1, is_locked=False,
        )
        # yellow: inside the teacher's unavailability window
        make_unavailability(teacher_1, 1, '08:00', '10:30')
        yellow = TimeSlot.objects.create(
            timetable=tt, day_of_week=1, start_time='08:20', end_time='09:10',
            subject=english, teacher=teacher_1, is_locked=False,
        )
        # red: same class, same cell, same group -> student clash
        red_a = TimeSlot.objects.create(
            timetable=tt, day_of_week=1, start_time='09:10', end_time='10:00',
            subject=physics, teacher=teacher_2, is_locked=False,
        )
        red_b = TimeSlot.objects.create(
            timetable=tt, day_of_week=1, start_time='09:10', end_time='10:00',
            subject=maths, teacher=teacher_2, is_locked=False,
        )
        # gray: TBD teacher (different cell so it stays clean of other clashes)
        gray = TimeSlot.objects.create(
            timetable=tt, day_of_week=2, start_time='08:20', end_time='09:10',
            subject=english, teacher=None, is_locked=False,
        )

        states = timetable_cell_states(tt)
        self.assertEqual(states[str(green.pk)]['level'], 'green')
        self.assertEqual(states[str(yellow.pk)]['level'], 'yellow')
        self.assertEqual(states[str(red_a.pk)]['level'], 'red')
        self.assertEqual(states[str(red_b.pk)]['level'], 'red')
        self.assertEqual(states[str(gray.pk)]['level'], 'gray')
        self.assertTrue(
            any(c['type'] == 'student_clash' for c in states[str(red_a.pk)]['conflicts'])
        )
        self.assertTrue(
            any(c['type'] == 'availability' for c in states[str(yellow.pk)]['conflicts'])
        )


class TestDoubles(TimetableTestCase):
    def test_11_double_periods_consecutive_not_split_by_break(self):
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4')
        chemistry = make_subject(self.tenant, 'Chemistry', '523', double_preferred=True)
        teacher = make_teacher(self.tenant)
        tt = make_timetable(self.tenant, self.year, cls)
        make_lesson(tt, chemistry, teacher=teacher, periods=8, is_double=True)

        result = self._generate([tt])
        self.assertTrue(result['ok'], result.get('message'))
        slots = self._slots(tt)
        self.assertEqual(len(slots), 8)

        # Our grid has a break between period 2 (09:10-10:00) and period 3
        # (10:30-11:20): pairs must never straddle it.
        by_day = {}
        for s in slots:
            by_day.setdefault(s.day_of_week, []).append(s)
        for day, day_slots in by_day.items():
            day_slots.sort(key=lambda s: s.start_time)
            self.assertEqual(len(day_slots) % 2, 0)
            for i in range(0, len(day_slots), 2):
                a, b = day_slots[i], day_slots[i + 1]
                self.assertEqual(a.end_time, b.start_time,
                                 f'double pair split on {self._day_of(a)}')
                self.assertNotEqual(a.end_time, time(10, 0),
                                    'pair must not straddle the lunch break')

        issues = validate_timetable(tt)
        self.assertEqual([i for i in issues if i['type'] == 'double_integrity'], [])

    def test_11b_double_infeasible_reports_exact_diagnostic(self):
        # Doubles are HARD same-day consecutive blocks (spec §34): when the
        # teacher's unavailability leaves no consecutive pair slot, the
        # solver must report infeasibility with a double diagnostic — it
        # must NEVER silently convert the doubles into singles.
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4')
        chemistry = make_subject(self.tenant, 'Chemistry', '523', double_preferred=True)
        teacher = make_teacher(self.tenant)
        tt = make_timetable(self.tenant, self.year, cls)
        make_lesson(tt, chemistry, teacher=teacher, periods=8, is_double=True)

        # Block periods 08:20-09:10 and 09:10-10:00 every day: the only free
        # cells are 07:30-08:20 and 10:30-11:20, which are never consecutive.
        for d in range(1, 6):
            make_unavailability(teacher, day=d, start='08:20', end='10:00')

        result = self._generate([tt])
        self.assertFalse(result['ok'])
        self.assertEqual(result['status'], 'infeasible')
        self.assertIn('double', result['message'].lower())
        self.assertEqual(result['diagnostics']['required_double_sessions'], 4)
        self.assertEqual(result['diagnostics']['placeable_double_sessions'], 0)
        self.assertEqual(tt.slots.count(), 0, 'nothing may be materialised on a failed solve')

    def test_11c_odd_volume_is_double_plus_single(self):
        # Chemistry 3 periods/week + is_double => ONE double session (two
        # consecutive same-day periods) + ONE single session (spec §9-A).
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4')
        chemistry = make_subject(self.tenant, 'Chemistry', '523', double_preferred=True)
        teacher = make_teacher(self.tenant)
        tt = make_timetable(self.tenant, self.year, cls)
        make_lesson(tt, chemistry, teacher=teacher, periods=3, is_double=True)

        result = self._generate([tt])
        self.assertTrue(result['ok'], result.get('message'))
        slots = self._slots(tt)
        self.assertEqual(len(slots), 3)
        self.assertEqual(self._count_double_pairs(slots), 1)
        issues = validate_timetable(tt)
        self.assertEqual([i for i in issues if i['type'] == 'double_integrity'], [])

    def test_11d_two_doubles_create_four_periods(self):
        # Physics 4 periods/week + is_double => exactly TWO non-overlapping
        # double sessions = 4 periods, never four weekly singles (spec §10-B).
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4')
        physics = make_subject(self.tenant, 'Physics', '525', double_preferred=True)
        teacher = make_teacher(self.tenant)
        tt = make_timetable(self.tenant, self.year, cls)
        make_lesson(tt, physics, teacher=teacher, periods=4, is_double=True)

        result = self._generate([tt])
        self.assertTrue(result['ok'], result.get('message'))
        slots = self._slots(tt)
        self.assertEqual(len(slots), 4)
        self.assertEqual(self._count_double_pairs(slots), 2)
        issues = validate_timetable(tt)
        self.assertEqual([i for i in issues if i['type'] == 'double_integrity'], [])

    def test_11e_manual_split_reported_as_double_integrity_error(self):
        # Moving one half of a double to another day is a HARD violation:
        # validation must detect it and block approval (spec §28-29).
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4')
        maths = make_subject(self.tenant, 'Mathematics', '570', double_preferred=True)
        teacher = make_teacher(self.tenant)
        tt = make_timetable(self.tenant, self.year, cls)
        make_lesson(tt, maths, teacher=teacher, periods=8, is_double=True)

        result = self._generate([tt])
        self.assertTrue(result['ok'], result.get('message'))
        slots = sorted(self._slots(tt), key=lambda s: (s.day_of_week, s.start_time))
        # Break one pair: move the second half of the first pair to Friday.
        a, b = slots[0], slots[1]
        self.assertEqual(b.start_time, a.end_time, 'sanity: first two slots are a pair')
        b.day_of_week = 5
        b.save(update_fields=['day_of_week'])

        issues = validate_timetable(tt)
        errors = [i for i in issues if i['type'] == 'double_integrity']
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0]['severity'], 'error')
        self.assertEqual(errors[0]['code'], 'DOUBLE_COUNT_MISMATCH')
        # Approval must be blocked while the double is split.
        self.assertFalse(validate_section([tt])['valid'])

    def test_11f_double_count_is_not_weekly_occurrence_count(self):
        # Four periods of the same subject on different days are NOT two
        # doubles (spec §6, §26): validation reports the count mismatch.
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        teacher = make_teacher(self.tenant)
        tt = make_timetable(self.tenant, self.year, cls)
        lesson = make_lesson(tt, maths, teacher=teacher, periods=4, is_double=True)
        for day, (p_start, p_end) in enumerate([
            ('07:30', '08:20'), ('08:20', '09:10'), ('09:10', '10:00'), ('10:30', '11:20'),
        ], start=1):
            TimeSlot.objects.create(
                timetable=tt, lesson=lesson, subject=maths, teacher=teacher,
                day_of_week=day, start_time=_to_time(p_start), end_time=_to_time(p_end),
            )

        issues = validate_timetable(tt)
        mismatches = [
            i for i in issues
            if i['type'] == 'double_integrity' and i.get('code') == 'DOUBLE_COUNT_MISMATCH'
        ]
        self.assertEqual(len(mismatches), 1)
        self.assertIn('requires 2 double session(s)', mismatches[0]['message'])

    def test_11g_unassigned_teacher_double_can_be_generated(self):
        # A double with no assigned teacher schedules as TBD with no false
        # teacher conflict (spec §37).
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4')
        maths = make_subject(self.tenant, 'Mathematics', '570', double_preferred=True)
        tt = make_timetable(self.tenant, self.year, cls)
        make_lesson(tt, maths, teacher=None, periods=8, is_double=True)

        result = self._generate([tt])
        self.assertTrue(result['ok'], result.get('message'))
        slots = self._slots(tt)
        self.assertEqual(len(slots), 8)
        self.assertEqual(self._count_double_pairs(slots), 4)
        issues = validate_timetable(tt)
        self.assertEqual([i for i in issues if i['type'] == 'teacher_clash'], [])

    def test_11h_double_respects_cross_section_occupancy(self):
        # A double consumes BOTH periods school-wide (spec §16): an approved
        # timetable in another section occupying either half blocks the pair.
        anglo = make_section(self.tenant, 'Anglophone')
        franco = make_section(self.tenant, 'Francophone')
        cls_a = make_class(self.tenant, anglo, 'Form 4')
        cls_f = make_class(self.tenant, franco, '4ème')
        maths = make_subject(self.tenant, 'Mathematics', '570', double_preferred=True)
        french = make_subject(self.tenant, 'French', '502', double_preferred=True)
        teacher = make_teacher(self.tenant)
        make_assignment(teacher, cls_a, maths)
        make_assignment(teacher, cls_f, french)
        tt_a = make_timetable(self.tenant, self.year, cls_a)
        tt_f = make_timetable(self.tenant, self.year, cls_f)
        make_lesson(tt_a, maths, teacher=teacher, periods=4, is_double=True)
        make_lesson(tt_f, french, teacher=teacher, periods=4, is_double=True)

        result = self._generate([tt_a])
        self.assertTrue(result['ok'], result.get('message'))
        tt_a.generation_status = Timetable.GenerationStatus.APPROVED
        tt_a.save(update_fields=['generation_status'])

        result_f = self._generate([tt_f, tt_a], target_ids={tt_f.id})
        self.assertTrue(result_f['ok'], result_f.get('message'))
        committed = [s for s in self._slots(tt_a) if s.teacher_id == teacher.id]
        new = [s for s in self._slots(tt_f) if s.teacher_id == teacher.id]
        self.assertEqual(len(committed), 4)
        self.assertEqual(len(new), 4)
        overlaps = 0
        for a in committed:
            for b in new:
                if a.day_of_week == b.day_of_week and _overlaps(
                    a.start_time, a.end_time, b.start_time, b.end_time
                ):
                    overlaps += 1
        self.assertEqual(overlaps, 0, 'neither half of a double may overlap a committed slot')
        self.assertEqual(self._count_double_pairs(new), 2)

    def test_11i_default_rule_materialises_two_real_doubles(self):
        # FINAL ACCEPTANCE: a subject with 4 periods/week and NO double
        # configuration must come out as 2 actual consecutive same-day
        # blocks = 4 real timetable cells, never 4 isolated singles. The
        # default rule (Cameroon norm) applies automatically; explicit
        # configuration is not required for doubles to appear.
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4B')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        english = make_subject(self.tenant, 'English Language', '301')
        teacher_m = make_teacher(self.tenant)
        teacher_e = make_teacher(self.tenant)
        make_class_subject(cls, maths, 4)
        make_class_subject(cls, english, 4)
        make_assignment(teacher_m, cls, maths)
        make_assignment(teacher_e, cls, english)
        tt = make_timetable(self.tenant, self.year, cls)

        created, total, doubles, error = suggest_lessons_for(tt)
        self.assertIsNone(error)
        lessons = {l.subject.name: l for l in tt.lessons.all()}
        self.assertEqual(lessons['Mathematics'].periods_per_week, 4)
        self.assertTrue(lessons['Mathematics'].is_double,
                        'default rule must mark the 4h lesson as a double')
        self.assertEqual(lessons['English Language'].periods_per_week, 4)
        self.assertTrue(lessons['English Language'].is_double)

        result = self._generate([tt])
        self.assertTrue(result['ok'], result.get('message'))
        slots = self._slots(tt)
        self.assertEqual(len(slots), 8)
        maths_slots = [s for s in slots if s.subject_id == maths.id]
        english_slots = [s for s in slots if s.subject_id == english.id]
        self.assertEqual(self._count_double_pairs(maths_slots), 2,
                         'Mathematics must be 2 real consecutive same-day blocks')
        self.assertEqual(self._count_double_pairs(english_slots), 2,
                         'another 2-double subject must materialise elsewhere in the week')
        issues = validate_timetable(tt)
        self.assertEqual([i for i in issues if i['type'] == 'double_integrity'], [])

    def test_11j_default_rule_respects_capacity_and_explicit_override(self):
        # The default rule fills the week's consecutive-block capacity (one
        # block per day on the test grid = 5/week); subjects beyond it stay
        # singles, and an explicit is_double=False always wins over it.
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4B')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        english = make_subject(self.tenant, 'English', '301')
        civics = make_subject(self.tenant, 'Citizenship Education', '320')
        geology = make_subject(self.tenant, 'Geology', '525')
        history = make_subject(self.tenant, 'History', '235')
        make_class_subject(cls, maths, 4)
        make_class_subject(cls, english, 4)
        make_class_subject(cls, civics, 3, is_double=False)
        make_class_subject(cls, geology, 3)
        make_class_subject(cls, history, 3)
        tt = make_timetable(self.tenant, self.year, cls)

        created, total, doubles, error = suggest_lessons_for(tt)
        self.assertIsNone(error)
        self.assertEqual(doubles, 5, '2+2+1 blocks exactly fill the 5-block week')
        self.assertEqual(total, 17)
        lessons = {l.subject.name: l for l in tt.lessons.all()}
        self.assertTrue(lessons['Mathematics'].is_double)
        self.assertTrue(lessons['English'].is_double)
        self.assertFalse(lessons['Citizenship Education'].is_double,
                         'explicit is_double=False must override the default rule')
        geo_lessons = list(tt.lessons.filter(subject=geology))
        self.assertTrue(any(l.is_double for l in geo_lessons),
                        'Geology takes the last available block')
        self.assertFalse(all(l.is_double for l in geo_lessons),
                         'odd volume: 1 double + 1 single for Geology')
        self.assertFalse(lessons['History'].is_double,
                         'History exceeds weekly block capacity -> generated as singles')


class TestHalfDays(TimetableTestCase):
    def test_12_half_day_grid_respected(self):
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        teacher = make_teacher(self.tenant)
        # Wednesday (day 3) is a half-day: only 2 periods.
        tt = make_timetable(
            self.tenant, self.year, cls,
            day_periods={'3': self.periods[:2]},
        )
        make_lesson(tt, maths, teacher=teacher, periods=8)

        result = self._generate([tt])
        self.assertTrue(result['ok'], result.get('message'))
        for s in self._slots(tt):
            if s.day_of_week == 3:
                self.assertLess(s.start_time, time(9, 10),
                                'Wednesday is a half-day: nothing after period 2')
        issues = validate_timetable(tt)
        self.assertEqual([i for i in issues if i['type'] == 'boundary'], [])


class TestBlockedPeriods(TimetableTestCase):
    def test_13_blocked_periods_contain_no_lessons(self):
        section = make_section(self.tenant)
        cls = make_class(self.tenant, section, 'Form 4')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        teacher = make_teacher(self.tenant)
        blocked = [{'day': d, 'start': '10:00', 'end': '10:30', 'label': 'lunch'}
                   for d in range(1, 6)]
        tt = make_timetable(self.tenant, self.year, cls, blocked_slots=blocked)
        make_lesson(tt, maths, teacher=teacher, periods=8)

        result = self._generate([tt])
        self.assertTrue(result['ok'], result.get('message'))
        for s in self._slots(tt):
            self.assertFalse(
                _overlaps(s.start_time, s.end_time, time(10, 0), time(10, 30)),
                f'{s.subject.name} must never sit inside the lunch break',
            )
        issues = validate_timetable(tt)
        self.assertEqual([i for i in issues if i['type'] == 'blocked_period'], [])


class TestRepairMode(TimetableTestCase):
    def test_14_repair_mode_keeps_other_class_intact(self):
        section = make_section(self.tenant)
        cls_a = make_class(self.tenant, section, 'Form 3A')
        cls_b = make_class(self.tenant, section, 'Form 3B')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        english = make_subject(self.tenant, 'English', '301')
        teacher_m = make_teacher(self.tenant)
        teacher_e = make_teacher(self.tenant)
        make_lesson(make_timetable(self.tenant, self.year, cls_a),
                    maths, teacher=teacher_m, periods=8)
        make_lesson(make_timetable(self.tenant, self.year, cls_b),
                    english, teacher=teacher_e, periods=8)
        tt_a = Timetable.objects.get(tenant=self.tenant, class_obj=cls_a)
        tt_b = Timetable.objects.get(tenant=self.tenant, class_obj=cls_b)

        result = self._generate([tt_a, tt_b])
        self.assertTrue(result['ok'], result.get('message'))
        snapshot_a = sorted(
            (s.day_of_week, s.start_time, s.end_time, s.subject_id, s.teacher_id)
            for s in self._slots(tt_a)
        )

        # Repair Form 3B only: Form 3A must come out byte-for-byte identical.
        result_r = self._generate([tt_a, tt_b], target_ids={tt_b.id})
        self.assertTrue(result_r['ok'], result_r.get('message'))
        after_a = sorted(
            (s.day_of_week, s.start_time, s.end_time, s.subject_id, s.teacher_id)
            for s in self._slots(tt_a)
        )
        self.assertEqual(snapshot_a, after_a, 'repair must not touch the other class')


class TestApprovalFlow(APITestCase):
    def test_15_approve_requires_clean_timetable_and_commits_resources(self):
        from .base import PERIODS, WORKING_DAYS
        tenant = make_tenant()
        user = make_user(is_platform_admin=True)
        section = make_section(tenant, 'Anglophone')
        cls = make_class(tenant, section, 'Form 4')
        maths = make_subject(tenant, 'Mathematics', '570')
        teacher = make_teacher(tenant)
        tt = Timetable.objects.create(
            tenant=tenant, academic_year=make_year(tenant), class_obj=cls,
            periods=PERIODS, working_days=WORKING_DAYS, is_active=True,
        )
        make_lesson(tt, maths, teacher=teacher, periods=8)
        solver = SchoolSolver([tt], time_limit_seconds=30)
        result = solver.solve()
        self.assertTrue(result['ok'], result.get('message'))

        self.client.force_authenticate(user=user)
        url = f'/api/v1/timetable/timetables/{tt.pk}/approve/'
        headers = {'HTTP_X_TENANT_ID': str(tenant.id)}

        # Clean timetable -> approved.
        resp = self.client.post(url, {}, format='json', **headers)
        self.assertEqual(resp.status_code, 200, resp.content)
        tt.refresh_from_db()
        self.assertEqual(tt.generation_status, Timetable.GenerationStatus.APPROVED)
        self.assertTrue(tt.is_committed())
        self.assertEqual(tt.approved_by_id, user.id)
        self.assertIsNotNone(tt.approved_at)

        # Double-approve is rejected.
        resp = self.client.post(url, {}, format='json', **headers)
        self.assertEqual(resp.status_code, 400, resp.content)

        # A RED clash blocks approval.
        other = Timetable.objects.create(
            tenant=tenant, academic_year=tt.academic_year, class_obj=make_class(
                tenant, section, 'Form 3'
            ),
            periods=PERIODS, working_days=WORKING_DAYS, is_active=True,
        )
        make_lesson(other, maths, teacher=teacher, periods=8)
        solver2 = SchoolSolver([other, tt], target_ids={other.id}, time_limit_seconds=30)
        result2 = solver2.solve()
        self.assertTrue(result2['ok'], result2.get('message'))
        # force a clash: move one slot of `other` on top of a committed slot
        committed = TimeSlot.objects.filter(timetable=tt, teacher=teacher).first()
        # clear any `other` slot at that cell first so the RED issue is the
        # cross-section committed clash, not an internal one
        TimeSlot.objects.filter(
            timetable=other, day_of_week=committed.day_of_week,
            start_time=committed.start_time, end_time=committed.end_time,
        ).delete()
        victim = TimeSlot.objects.filter(timetable=other, teacher=teacher).first()
        victim.day_of_week = committed.day_of_week
        victim.start_time = committed.start_time
        victim.end_time = committed.end_time
        victim.save()
        url2 = f'/api/v1/timetable/timetables/{other.pk}/approve/'
        resp = self.client.post(url2, {}, format='json', **headers)
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertIn(b'hard clash', resp.content)
        other.refresh_from_db()
        self.assertNotEqual(other.generation_status, Timetable.GenerationStatus.APPROVED)


class TestSectionValidation(TimetableTestCase):
    def test_16_validate_section_internal_and_against_school(self):
        anglo = make_section(self.tenant, 'Anglophone')
        franco = make_section(self.tenant, 'Francophone')
        cls_a = make_class(self.tenant, anglo, 'Form 4')
        cls_f = make_class(self.tenant, franco, '4ème')
        maths = make_subject(self.tenant, 'Mathematics', '570')
        french = make_subject(self.tenant, 'French', '502')
        teacher = make_teacher(self.tenant)
        teacher_f = make_teacher(self.tenant)
        tt_a = make_timetable(self.tenant, self.year, cls_a)
        tt_f = make_timetable(self.tenant, self.year, cls_f)
        make_lesson(tt_a, maths, teacher=teacher, periods=8)
        make_lesson(tt_f, french, teacher=teacher_f, periods=8)
        self._generate([tt_a])
        self._generate([tt_f])

        # Internal: both sections are individually clean.
        report_a = validate_section([tt_a])
        report_f = validate_section([tt_f])
        self.assertTrue(report_a['valid'], report_a['issues'])
        self.assertTrue(report_f['valid'], report_f['issues'])

        # Commit Anglophone; Francophone must not clash with it.
        tt_a.generation_status = Timetable.GenerationStatus.APPROVED
        tt_a.save(update_fields=['generation_status'])
        school_report = validate_section_against_school([tt_f])
        self.assertTrue(school_report['valid'], school_report['issues'])

        # Force a cross-section RED clash: Francophone's teacher is committed
        # in Anglophone at the same cell. Clear any tt_f slot at that cell so
        # the only RED issue is the school clash. If a French slot was removed,
        # the clash slot takes its place to keep the weekly volume intact.
        committed = TimeSlot.objects.filter(timetable=tt_a, teacher=teacher).first()
        removed = TimeSlot.objects.filter(
            timetable=tt_f, day_of_week=committed.day_of_week,
            start_time=committed.start_time, end_time=committed.end_time,
        ).delete()[0]
        clash_slot = TimeSlot.objects.create(
            timetable=tt_f, day_of_week=committed.day_of_week,
            start_time=committed.start_time, end_time=committed.end_time,
            subject=french, teacher=teacher,
            lesson=tt_f.lessons.first() if removed else None,
        )
        school_report = validate_section_against_school([tt_f])
        self.assertFalse(school_report['valid'])
        self.assertTrue(
            any(i['type'] == 'school_teacher_clash' for i in school_report['issues'])
        )

        # Internal validation still passes: the clash is only vs the school.
        report_f2 = validate_section([tt_f])
        self.assertTrue(report_f2['valid'], report_f2['issues'])

        # validate_timetable surfaces the cross-section clash as RED too.
        issues = validate_timetable(tt_f)
        self.assertTrue(
            any(i['type'] == 'school_teacher_clash' for i in issues)
        )
