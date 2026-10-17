/* Sample data shown with ?demo=1 so the page can be previewed before the sheet is connected. */
window.DEMO_DATA = (function () {
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };
  return {
    project: {
      name: "Company Website Redesign",
      client: "Demo Client",
      startDate: day(-24),
      deadline: day(18),
      status: "On track",
      summary: "New responsive website with booking form, admin panel and SEO setup.",
    },
    tasks: [
      { task: "Requirements & sitemap", status: "Done", dueDate: day(-20), note: "" },
      { task: "UI design (Figma)", status: "Done", dueDate: day(-12), note: "Approved" },
      { task: "Home & About pages", status: "Done", dueDate: day(-5), note: "" },
      { task: "Booking form", status: "In progress", dueDate: day(3), note: "Email notifications being added" },
      { task: "Admin panel", status: "In progress", dueDate: day(8), note: "" },
      { task: "Product photos", status: "Waiting for client", dueDate: day(2), note: "Need final photos from you" },
      { task: "SEO setup", status: "To do", dueDate: day(12), note: "" },
      { task: "Launch & handover", status: "To do", dueDate: day(18), note: "" },
    ],
    updates: [
      { date: new Date(Date.now() - 3 * 3600e3).toISOString(), message: "Booking form now saves entries; working on email alerts." },
      { date: day(-2), message: "Home and About pages are live on the preview link." },
      { date: day(-9), message: "UI design approved — development started." },
    ],
    lastUpdated: new Date(Date.now() - 3 * 3600e3).toISOString(),
  };
})();
