"""OCR 模块 — 默认关闭，需安装 PaddleOCR 后启用"""
from typing import Optional, Tuple


def extract_invoice_info(file_bytes: bytes) -> Tuple[Optional[str], Optional[float]]:
    """对发票图片做 OCR，提取发票号和金额（含税）。
    需要先：pip install paddleocr paddlepaddle"""
    try:
        from paddleocr import PaddleOCR
        from PIL import Image
        import io, re

        ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
        img = Image.open(io.BytesIO(file_bytes))
        result = ocr.ocr(img, cls=True)

        if not result or not result[0]:
            return None, None

        texts = [line[1][0] for line in result[0]]
        full_text = " ".join(texts)

        # 发票号：10 位数字
        invoice_no = None
        match_no = re.search(r"\b(\d{10})\b", full_text)
        if match_no:
            invoice_no = match_no.group(1)

        # 金额：查找「价税合计」或「合计」后的数字
        amount = None
        for pattern in [r"(?:价税合计|合计|金额)[^\d]*([\d,]+\.\d{2})", r"¥\s*([\d,]+\.\d{2})"]:
            m = re.search(pattern, full_text)
            if m:
                amount_str = m.group(1).replace(",", "")
                amount = float(amount_str)
                break

        return invoice_no, amount
    except Exception:
        return None, None
