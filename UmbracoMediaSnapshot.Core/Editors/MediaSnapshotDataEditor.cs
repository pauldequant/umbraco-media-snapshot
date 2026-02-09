namespace UmbracoMediaSnapshot.Core.Editors
{
    using Umbraco.Cms.Core.PropertyEditors;

    /// <summary>
    /// Defines the <see cref="MediaSnapshotDataEditor" />
    /// </summary>
    [DataEditor("UmbracoMediaSnapshot.PropertyEditorUi", ValueType = "JSON")]
    public class MediaSnapshotDataEditor : DataEditor
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="MediaSnapshotDataEditor"/> class.
        /// </summary>
        /// <param name="dataValueEditorFactory">The dataValueEditorFactory<see cref="IDataValueEditorFactory"/></param>
        public MediaSnapshotDataEditor(IDataValueEditorFactory dataValueEditorFactory)
            : base(dataValueEditorFactory)
        {
        }
    }
}
