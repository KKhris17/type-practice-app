---
type-practice-version: 2
title: Type Practice Guide
collection-id: type-practice-guide
collection-title: Type Practice Guide
part-title: Reading your results
part-order: 1
source-title: Type Practice README
---

# Type Practice Guide - Reading your results

## Set: How practice metrics work

### Passage

```passage
Type Practice calculates WPM from the correct characters left in the final text and the time spent typing. Five characters count as one word. Accuracy uses correct key insertions divided by all key insertions, so correcting an error does not remove it from the score. After a session, the result screen highlights typing pace for each completed word. Focused drills group nearby US QWERTY keys by finger and emphasize common Practice errors.
```

### Thai explanation

```thai-explanation
บทฝึกนี้อธิบายวิธีอ่านผลใน Type Practice ค่า WPM คำนวณจากจำนวนตัวอักษรที่ถูกต้องในข้อความสุดท้ายและเวลาที่ใช้ โดยคิดห้าตัวอักษรเป็นหนึ่งคำ ส่วน accuracy เทียบจำนวนครั้งที่กดแป้นถูกกับจำนวนครั้งที่กดทั้งหมด ดังนั้นแม้จะแก้คำผิดแล้ว ความผิดพลาดนั้นก็ยังอยู่ในคะแนน หลังจบการฝึก หน้าผลลัพธ์จะแสดงความเร็วของแต่ละคำ และแบบฝึกเฉพาะจุดจะนำข้อผิดพลาดจาก Practice มาจัดกลุ่มแป้น US QWERTY ที่อยู่ใกล้กันตามนิ้ว
```

### Evidence

#### Evidence: WPM calculation
- Locator: README.md — Metrics, WPM bullet

```evidence
- WPM uses correct final characters divided by five and by elapsed minutes.
```

#### Evidence: Accuracy calculation
- Locator: README.md — Metrics, Accuracy bullet

```evidence
- Accuracy uses correct key insertions divided by all key insertions, so corrected errors still count.
```

#### Evidence: Word-level pace
- Locator: README.md — Metrics, Burst heatmap bullet

```evidence
- The result screen shows a word-level Burst heatmap. It measures time inside each completed word, normalizes by key intervals, and colors words relative to that session's median for the same writing system; the pause before a word is excluded.
```

#### Evidence: Focused drills
- Locator: README.md — Metrics, Weakness and Focused drills bullets

```evidence
- Weakness percentages and scores use Practice sessions only. Weakness Drill sessions remain in general progress but never feed back into the weakness model.
- Focused drills group nearby US QWERTY keys by finger. Combined drills interleave those groups and weight groups with more frequent Practice errors more heavily.
```
