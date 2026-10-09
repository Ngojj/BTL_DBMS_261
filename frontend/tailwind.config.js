// Bảng màu lấy từ mockup TicketRush
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14151a', // nền header / chữ
        paper: '#f3f2ee', // nền trang
        brand: '#b93a17', // nút chính
        glow: '#ff7043', // chữ "Rush", đường quét
        royal: '#2b3acb', // ghế đang chọn, link
        gold: '#f5b73b', // ghế người khác đang giữ, cảnh báo
        sold: '#5f6068', // ghế đã bán
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
