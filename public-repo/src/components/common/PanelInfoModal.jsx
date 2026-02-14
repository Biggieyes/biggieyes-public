import * as React from "react";
import ModalPortal from "./ModalPortal";

const PanelInfoModal = ({ open, title = "Button info", items = [], onClose }) => {
  if (!open) return null;

  const renderDescription = (desc) => {
    if (Array.isArray(desc)) {
      return (
        <ul className="panel-info-modal__sublist">
          {desc.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      );
    }
    return desc;
  };

  return (
    <ModalPortal className="panel-info-modal-root">
      <div
        className="panel-info-modal__overlay"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={onClose}
      >
        <div
          className="panel-info-modal__card"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="panel-info-modal__header">
            <h3>{title}</h3>
            <button
              type="button"
              className="panel-info-modal__close"
              onClick={onClose}
              aria-label="Close info modal"
            >
              Close
            </button>
          </div>
          <div className="panel-info-modal__body">
            {items?.length ? (
              <table className="panel-info-modal__table">
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.label}>
                      <td className="panel-info-modal__cell-label">
                        {item.label}
                      </td>
                      <td className="panel-info-modal__cell-desc">
                        {renderDescription(item.description)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="panel-info-modal__empty">No info available.</p>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default React.memo(PanelInfoModal);
