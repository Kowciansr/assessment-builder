const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  LevelFormat,
} = require('docx');

// ============================================================
// CSV EXPORT
// ============================================================
function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportToCSV(questions) {
  const headers = [
    'ID', 'Question', 'Type', 'Correct Answer',
    'Distractor 1', 'Distractor 2', 'Distractor 3',
    'Explanation', "Bloom's Level", 'Difficulty',
    'Objective Alignment', 'Confidence Score', 'QA Score', 'Tags',
  ];

  const rows = questions.map((q) => [
    q.id,
    q.question_text,
    q.question_type,
    q.correct_answer,
    q.distractor_1 || '',
    q.distractor_2 || '',
    q.distractor_3 || '',
    q.explanation,
    q.blooms_level,
    q.difficulty,
    q.objective_alignment || '',
    q.confidence_score || '',
    q.qa_score || '',
    Array.isArray(q.tags) ? q.tags.join('; ') : (q.tags || ''),
  ]);

  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvField).join(',')
  );

  return lines.join('\n');
}

// ============================================================
// JSON EXPORT (LMS-friendly structured format)
// ============================================================
function exportToJSON(questions) {
  const lmsQuestions = questions.map((q, index) => {
    const options = [];

    if (q.question_type === 'true_false') {
      options.push({ id: 'A', text: 'True', correct: q.correct_answer === 'True' });
      options.push({ id: 'B', text: 'False', correct: q.correct_answer === 'False' });
    } else {
      // Shuffle correct answer among distractors
      const allOptions = [
        { text: q.correct_answer, correct: true },
        ...[q.distractor_1, q.distractor_2, q.distractor_3]
          .filter(Boolean)
          .map((d) => ({ text: d, correct: false })),
      ];

      // Assign letters A-D
      allOptions.forEach((opt, i) => {
        options.push({ id: String.fromCharCode(65 + i), ...opt });
      });
    }

    return {
      id: q.id,
      sequence: index + 1,
      type: q.question_type,
      stem: q.question_text,
      options,
      explanation: q.explanation,
      metadata: {
        blooms_level: q.blooms_level,
        difficulty: q.difficulty,
        objective_alignment: q.objective_alignment,
        confidence_score: q.confidence_score,
        qa_score: q.qa_score,
        tags: Array.isArray(q.tags) ? q.tags : [],
      },
    };
  });

  return JSON.stringify(
    {
      schema_version: '1.0',
      export_date: new Date().toISOString(),
      total_questions: lmsQuestions.length,
      questions: lmsQuestions,
    },
    null,
    2
  );
}

// ============================================================
// DOCX EXPORT
// ============================================================
async function exportToDocx(questions) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const tableBorders = {
    top: border, bottom: border, left: border, right: border,
    insideH: border, insideV: border,
  };

  const labelStyle = { bold: true, size: 20, font: 'Arial', color: '2E4057' };
  const bodyStyle = { size: 20, font: 'Arial' };

  function cell(text, isHeader = false, width = 4680) {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders: tableBorders,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      shading: isHeader
        ? { fill: 'E8F0FE', type: ShadingType.CLEAR }
        : { fill: 'FFFFFF', type: ShadingType.CLEAR },
      children: [
        new Paragraph({
          children: [
            new TextRun(isHeader ? { text, ...labelStyle } : { text, ...bodyStyle }),
          ],
        }),
      ],
    });
  }

  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Assessment Question Bank', font: 'Arial', size: 40, bold: true, color: '1A1A2E' })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()} | Total Questions: ${questions.length}`, font: 'Arial', size: 18, color: '666666' })],
      spacing: { after: 400 },
    }),
  ];

  questions.forEach((q, index) => {
    const optionLetters = ['A', 'B', 'C', 'D'];
    const allOptions =
      q.question_type === 'true_false'
        ? [
            { letter: 'A', text: 'True', correct: q.correct_answer === 'True' },
            { letter: 'B', text: 'False', correct: q.correct_answer === 'False' },
          ]
        : [
            { letter: 'A', text: q.correct_answer, correct: true },
            { letter: 'B', text: q.distractor_1 || '', correct: false },
            { letter: 'C', text: q.distractor_2 || '', correct: false },
            { letter: 'D', text: q.distractor_3 || '', correct: false },
          ].filter((o) => o.text);

    // Question header
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Question ${index + 1}`, font: 'Arial', size: 24, bold: true, color: '2E4057' }),
          new TextRun({ text: `  [${q.blooms_level.toUpperCase()}] [${q.difficulty.toUpperCase()}] [${q.question_type.replace('_', ' ')}]`, font: 'Arial', size: 18, color: '888888' }),
        ],
        spacing: { before: 400, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E8F0FE' } },
      })
    );

    // Question text
    children.push(
      new Paragraph({
        children: [new TextRun({ text: q.question_text, font: 'Arial', size: 22, bold: false })],
        spacing: { before: 120, after: 160 },
      })
    );

    // Options
    allOptions.forEach((opt) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${opt.letter}. ${opt.text}`,
              font: 'Arial',
              size: 20,
              bold: opt.correct,
              color: opt.correct ? '2D6A4F' : '333333',
            }),
            ...(opt.correct ? [new TextRun({ text: '  ✓ CORRECT', font: 'Arial', size: 18, bold: true, color: '2D6A4F' })] : []),
          ],
          spacing: { before: 60, after: 60 },
          indent: { left: 360 },
        })
      );
    });

    // Explanation
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Explanation: ', font: 'Arial', size: 20, bold: true, color: '5C4033' }),
          new TextRun({ text: q.explanation || '', font: 'Arial', size: 20, italics: true, color: '5C4033' }),
        ],
        spacing: { before: 120, after: 80 },
        indent: { left: 360 },
      })
    );

    // Objective alignment
    if (q.objective_alignment) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Objective: ', font: 'Arial', size: 18, bold: true, color: '666666' }),
            new TextRun({ text: q.objective_alignment, font: 'Arial', size: 18, color: '666666' }),
          ],
          spacing: { before: 40, after: 40 },
          indent: { left: 360 },
        })
      );
    }

    // Scores
    const scoreText = [
      q.confidence_score ? `Confidence: ${q.confidence_score}/10` : null,
      q.qa_score ? `QA: ${q.qa_score}/10` : null,
    ]
      .filter(Boolean)
      .join('  |  ');

    if (scoreText) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: scoreText, font: 'Arial', size: 18, color: '999999' })],
          spacing: { before: 40, after: 200 },
          indent: { left: 360 },
        })
      );
    }
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 20 } } },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 40, bold: true, font: 'Arial', color: '1A1A2E' },
          paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  return await Packer.toBuffer(doc);
}

module.exports = { exportToCSV, exportToJSON, exportToDocx };
