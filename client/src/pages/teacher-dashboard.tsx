import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, Trash2, LogOut, FileUp, Download } from "lucide-react";
import { useState, useRef } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

interface GradeEntry {
  id: string;
  studentName: string;
  subject: string;
  grade: number;
}

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [grades, setGrades] = useState<GradeEntry[]>([
    { id: "1", studentName: "Johnson, Alice", subject: "General Mathematics", grade: 92 },
    { id: "2", studentName: "Smith, Bob", subject: "Physical Education", grade: 78 },
    { id: "3", studentName: "Brown, Charlie", subject: "Contemporary Arts", grade: 85 },
  ]);

  const [newStudent, setNewStudent] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [newGradeError, setNewGradeError] = useState<string | null>(null);
  const [customSubject, setCustomSubject] = useState("");
  const [customSubjectError, setCustomSubjectError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<string[]>([
    "General Mathematics",
    "Physical Education",
    "Contemporary Arts",
    "Programming",
    "Animation",
    "Media Information Literacy",
  ]);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);
  const [duplicateSubjectError, setDuplicateSubjectError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"high-to-low" | "low-to-high">("high-to-low");
  const [alphabeticalSort, setAlphabeticalSort] = useState<"a-z" | "z-a" | "none">("none");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pass" | "fail">("all");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDownloadCSV = () => {
    const headers = ["Student Name", "Subject", "Grade", "Status"];
    const csvContent = [
      headers.join(","),
      ...sortedGrades.map((entry) =>
        [entry.studentName, entry.subject, entry.grade, entry.grade >= 75 ? "Passed" : "Failed"].map((v) =>
          typeof v === "string" && (v.includes(",") || v.includes("\"")) ? `\"${v.replace(/\"/g, "\"\"")}\"`  : v
        ).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `grades-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF();
      const headers = ["Student Name", "Subject", "Grade", "Status"];
      const rows = sortedGrades.map((entry) => [
        entry.studentName,
        entry.subject,
        entry.grade.toString(),
        entry.grade >= 75 ? "Passed" : "Failed"
      ]);

      doc.setFontSize(16);
      doc.text("Grading Report", 14, 22);
      doc.setFontSize(10);
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);

      if ((doc as any).autoTable) {
        (doc as any).autoTable({
          head: [headers],
          body: rows,
          startY: 40,
          theme: "grid",
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
          bodyStyles: { textColor: 50 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 }
        });
      } else {
        // Fallback if autoTable is not available
        let yPosition = 50;
        headers.forEach((header, index) => {
          doc.text(header, 14 + index * 40, yPosition);
        });
        rows.forEach((row, rowIndex) => {
          row.forEach((cell, colIndex) => {
            doc.text(cell, 14 + colIndex * 40, yPosition + 10 + rowIndex * 10);
          });
        });
      }

      doc.save(`grades-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const handleAddGrade = () => {
    if (newStudent && newSubject && newGrade.length === 2 && !newGradeError) {
      setGrades([
        ...grades,
        {
          id: Math.random().toString(36).substr(2, 9),
          studentName: newStudent,
          subject: newSubject,
          grade: parseInt(newGrade),
        },
      ]);
      setNewStudent("");
      setNewSubject("");
      setNewGrade("");
      setNewGradeError(null);
    }
  };

  const handleDelete = (id: string) => {
    setGrades(grades.filter((g) => g.id !== id));
  };

  const handleAddCustomSubject = () => {
    const val = customSubject.trim();
    if (!val) {
      setCustomSubjectError("Please enter a subject name");
      return;
    }
    if (subjects.includes(val)) {
      setCustomSubjectError("This subject already exists");
      return;
    }
    setSubjects((prev) => [...prev, val]);
    setNewSubject(val); // select the newly added subject
    setCustomSubject("");
    setCustomSubjectError(null);
  };

  //csv line splitter that respects quoted fields
  function splitCSVLine(line: string) {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        //next char for escaped quote
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++; //skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result;
  }

  function parseCSV(text: string) {
    const lines = text.split(/\r\n|\n/);
    const rows = lines.map((l) => splitCSVLine(l));
    //remove trailing empty lines
    return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
  }

  const handleImportFile = (file?: File) => {
    setImportErrors(null);
    setDuplicateSubjectError(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setImportErrors(["CSV is empty or invalid"]);
        return;
      }

      const headers = rows[0].map((h) => h.trim().toLowerCase());
      //map header to expected keys
      const colMap: Record<string, number> = {};
      headers.forEach((h, i) => {
        if (h.includes("student") || h.includes("name")) colMap.studentName = i;
        if (h.includes("subject")) colMap.subject = i;
        if (h.includes("grade")) colMap.grade = i;
      });

      if (colMap.studentName === undefined || colMap.subject === undefined || colMap.grade === undefined) {
        setImportErrors(["CSV must include headers: student (or name), subject, grade"]);
        return;
      }

      const newRows: GradeEntry[] = [];
      const errors: string[] = [];
      // Track subjects per student for duplicate detection, including existing grades
      const studentSubjects: Record<string, Set<string>> = {};
      // Initialize with existing grades
      grades.forEach((g) => {
        if (!studentSubjects[g.studentName]) studentSubjects[g.studentName] = new Set();
        studentSubjects[g.studentName].add(g.subject);
      });
      // Track all duplicate errors for import session
      const duplicateErrors: string[] = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        //tolerate shorter rows
        const student = (row[colMap.studentName] ?? "").trim();
        const subject = (row[colMap.subject] ?? "").trim();
        const gradeRaw = (row[colMap.grade] ?? "").trim();

        if (!student) {
          errors.push(`Row ${r + 1}: missing student name`);
          continue;
        }
        if (!subject) {
          errors.push(`Row ${r + 1}: missing subject`);
          continue;
        }
        // Check for duplicate subject for the same student (across all grades and this import)
        if (!studentSubjects[student]) studentSubjects[student] = new Set();
        if (studentSubjects[student].has(subject)) {
          duplicateErrors.push(`Row ${r + 1}: ${student} has duplicate subject "${subject}" in import file.`);
          continue;
        }
        studentSubjects[student].add(subject);

        //allow grades like 5, 05, 95, but ensure numeric and in 0-99
        if (!/^\d{1,3}$/.test(gradeRaw)) {
          errors.push(`Row ${r + 1}: grade must be numeric (0-99)`);
          continue;
        }
        const gradeNum = parseInt(gradeRaw, 10);
        if (Number.isNaN(gradeNum) || gradeNum < 0 || gradeNum > 99) {
          errors.push(`Row ${r + 1}: grade out of range (0-99)`);
          continue;
        }

        newRows.push({
          id: Math.random().toString(36).substr(2, 9),
          studentName: student,
          subject,
          grade: gradeNum,
        });
      }
      if (duplicateErrors.length > 0) {
        setDuplicateSubjectError(duplicateErrors.join("\n"));
        setTimeout(() => setDuplicateSubjectError(null), 10000);
      }

      if (errors.length) setImportErrors(errors);

      if (newRows.length) {
        //add new subjects to subject list
        const addedSubjects = new Set<string>();
        newRows.forEach((nr) => {
          if (!subjects.includes(nr.subject)) addedSubjects.add(nr.subject);
        });
        if (addedSubjects.size) {
          setSubjects((prev) => [...prev, ...Array.from(addedSubjects)]);
        }
        setGrades((prev) => [...prev, ...newRows]);
      }
    };
    reader.onerror = () => setImportErrors(["Failed to read file"]);
    reader.readAsText(file);
  };

  let filteredGrades = selectedSubject
    ? grades.filter((g) => g.subject === selectedSubject)
    : grades;

  if (statusFilter !== "all") {
    filteredGrades = filteredGrades.filter((g) =>
      statusFilter === "pass" ? g.grade >= 75 : g.grade < 75
    );
  }

  const sortedGrades = [...filteredGrades].sort((a, b) => {
    // Apply alphabetical sorting first
    if (alphabeticalSort === "a-z") {
      return a.studentName.localeCompare(b.studentName);
    } else if (alphabeticalSort === "z-a") {
      return b.studentName.localeCompare(a.studentName);
    }
    
    // Then apply grade sorting if no alphabetical sort
    let gradeSort = sortOrder === "high-to-low" ? b.grade - a.grade : a.grade - b.grade;
    return gradeSort;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
           
            <div>
              <img src="/logo.png" alt="GradeFlow Logo" />
              <h1 className="text-xl font-bold">Teacher Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={logout} className="text-muted-foreground hover:text-destructive">
              
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Input Section */}
        <Card className="shadow-sm border-primary/10">
          <CardHeader className="bg-primary/5 pb-4">
            <CardTitle className="text-primary flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Grade
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="student">Student Name</Label>
                <Input 
                  id="student" 
                  placeholder="e.g. Beyonce Calubaquib" 
                  value={newStudent}
                  onChange={(e) => setNewStudent(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Select value={newSubject} onValueChange={(v) => setNewSubject(v)}>
                  <SelectTrigger aria-label="Subject" className="bg-popover text-popover-foreground" style={{ backgroundColor: 'var(--color-background)', opacity: 1 }}>
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: 'var(--color-background)', opacity: 1 }}>
                    {subjects.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    placeholder="Add custom subject"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    className="flex-1 rounded-md border px-2 py-1 text-sm"
                    aria-label="Custom subject name"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddCustomSubject}
                    disabled={!customSubject.trim()}
                    className="whitespace-nowrap"
                  >
                    Add
                  </Button>
                </div>
                {customSubjectError ? (
                  <p className="text-sm text-destructive mt-1">{customSubjectError}</p>
                ) : null}

              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">Grade (00-99)</Label>
                <Input
                  id="grade"
                  type="text"
                  inputMode="numeric"
                  placeholder="95"
                  maxLength={2}
                  value={newGrade}
                  onChange={(e) => {
                    const raw = e.target.value;
                    //reject non-digits
                    if (/\D/.test(raw)) {
                      setNewGradeError("Grade must contain digits only");
                      return;
                    }
                    const digits = raw.slice(0, 2);
                    setNewGrade(digits);
                    setNewGradeError(null);
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData?.getData("text") ?? "";
                    if (/\D/.test(pasted)) {
                      setNewGradeError("Pasted content must contain digits only");
                      e.preventDefault();
                      return;
                    }
                    const digits = pasted.slice(0, 2);
                    setNewGrade((prev) => (prev + digits).slice(0, 2));
                    setNewGradeError(null);
                    e.preventDefault();
                  }}
                />
                {newGradeError ? (
                  <p className="text-sm text-destructive mt-1">{newGradeError}</p>
                ) : newGrade && newGrade.length < 2 ? (
                  <p className="text-sm text-muted-foreground mt-1">Grade must be exactly 2 digits</p>
                ) : null}
              </div>
              <div className="md:col-span-3 flex gap-3 items-start pt-2">
                <div className="flex-1">
                  <Button
                    onClick={handleAddGrade}
                    className="w-full shadow-sm"
                    data-testid="btn-add-grade"
                    disabled={!newStudent || !newSubject || newGrade.length !== 2 || !!newGradeError}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Grade
                  </Button>
                </div>

                <div className="w-48">
                  <input
                    id="csv-import"
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => handleImportFile(e.target.files?.[0])}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full shadow-sm border-gray-300 hover:border-gray-400"
                  >
                    <FileUp className="mr-2 h-4 w-4" />
                    Import CSV
                  </Button>
                  {importErrors && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-destructive">Import issues:</p>
                      <ul className="list-disc ml-5 text-sm text-destructive">
                        {importErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {duplicateSubjectError && (
                    <div className="mt-2">
                      {duplicateSubjectError.split("\n").map((err, idx) => (
                        <p key={idx} style={{ color: 'red' }} className="text-sm font-medium">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grading Sheet */}
        <Card className="shadow-md">
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Grading Sheet</CardTitle>
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  onClick={handleDownloadCSV}
                  disabled={sortedGrades.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={sortedGrades.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="alphabetical-sort" className="hidden md:block">Name</Label>
                <Select value={alphabeticalSort} onValueChange={(v) => setAlphabeticalSort(v as "a-z" | "z-a" | "none")}> 
                  <SelectTrigger aria-label="Alphabetical Sort" className="bg-popover text-popover-foreground" style={{ backgroundColor: 'var(--color-background)', opacity: 1 }}>
                    <SelectValue>{alphabeticalSort}</SelectValue>
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: 'var(--color-background)', opacity: 1 }} position="popper">
                    <SelectItem value="none">No Sort</SelectItem>
                    <SelectItem value="a-z">A - Z</SelectItem>
                    <SelectItem value="z-a">Z - A</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="subject-filter" className="hidden md:block">Subject</Label>
                <Select value={selectedSubject || "all"} onValueChange={(v) => setSelectedSubject(v === "all" ? "" : v)}>
                  <SelectTrigger aria-label="Subject Filter" className="bg-popover text-popover-foreground" style={{ backgroundColor: 'var(--color-background)', opacity: 1 }}>
                    <SelectValue placeholder="All Subjects" />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: 'var(--color-background)', opacity: 1 }} position="popper">
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="status-filter" className="hidden md:block">Status</Label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "pass" | "fail")}> 
                  <SelectTrigger aria-label="Status Filter" className="bg-popover text-popover-foreground" style={{ backgroundColor: 'var(--color-background)', opacity: 1 }}>
                    <SelectValue>{statusFilter}</SelectValue>
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: 'var(--color-background)', opacity: 1 }} position="popper">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pass">Passed</SelectItem>
                    <SelectItem value="fail">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="sort-order" className="hidden md:block">Sort</Label>
                <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "high-to-low" | "low-to-high")}> 
                  <SelectTrigger aria-label="Sort Order" className="bg-popover text-popover-foreground" style={{ backgroundColor: 'var(--color-background)', opacity: 1 }}>
                    <SelectValue>{sortOrder}</SelectValue>
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: 'var(--color-background)', opacity: 1 }} position="popper">
                    <SelectItem value="high-to-low">Highest to Lowest</SelectItem>
                    <SelectItem value="low-to-high">Lowest to Highest</SelectItem>
                  </SelectContent>
                </Select>
            </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Grade</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedGrades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No grades match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedGrades.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.studentName}</TableCell>
                      <TableCell>{entry.subject}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{entry.grade}</TableCell>
                      <TableCell className="text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          entry.grade >= 75 
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}>
                         {entry.grade >= 75 ? "Passed" : "Failed"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(entry.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
